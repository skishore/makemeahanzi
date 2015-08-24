'''
Given an svg.path.Path object representing a glyph, a StrokeExtractor instance
will break it down into a list of svg.path.Path objects, one for each stroke.

The algorithm we currently use is a 'corner-and-bridge' algorithm. First, we
detect possible corners in the path object. 'Corners' are points where the
derivative of the curve angle is sharply negative - that is, points at which
the curve is very non-convex. If two strokes cross eachother, we should detect
four corners, one at each place at the outline of the intersection.

(Note that much more complex configurations are possible - for example a stroke
may end at the middle of another stroke, or many strokes may intersect to form
a star shape.)

We then detect 'bridges', which are edges between corners where the stroke
entering one corner may continue to the stroke exiting the other corner. In our
two-strokes-crossing example, we should detect four bridges connecting the four
corners to form a simple quadrilateral.

Finally, we traverse the path, usually following SVG path elements, but taking
bridges when they are inline with the previously traversed path element. The
output of this traversal is our final stroke decomposition.

At many points during this algorithm we may detect various anomalies. We log
these anomalies so that they can be reviewed manually.
'''
import collections
import math
import svg.path


MAX_BRIDGE_DISTANCE = 128
MAX_CORNER_MERGE_DISTANCE = 16
MIN_CORNER_ANGLE = 0.1*math.pi
MIN_CORNER_TANGENT_DISTANCE = 4


def area(path):
  '''
  Returns the area of the path. The result is positive iff the path winds in
  the counter-clockwise direction.
  '''
  def area_under_curve(x):
    return (x.start.real - x.end.real)*(x.start.imag + x.end.imag)
  return int(sum(map(area_under_curve, path))/2)


def split_and_orient_path(path):
  '''
  Takes a non-empty svg.path.Path object that may contain multiple closed loops.
  Returns a list of svg.path.Path objects that are all minimal closed curve.
  The returned paths will be the way a TTF glyph should be: exterior curves
  will be counter-clockwise and interior curves will be clockwise.
  '''
  paths = [[path[0]]]
  for element in path[1:]:
    if element.start == element.end:
      continue
    if element.start != paths[-1][-1].end:
      paths.append([])
    paths[-1].append(element)
  # Determine if this glyph is oriented in the wrong direction by computing the
  # area of each glyph. The glyph with maximum |area| should have positive area,
  # because it must be an exterior path.
  def reverse(path):
    for element in path:
      (element.start, element.end) = (element.end, element.start)
    return reversed(path)
  areas = [area(path) for path in paths]
  max_area = max((abs(area), area) for area in areas)[1]
  if max_area < 0:
    paths = map(reverse, paths)
  return [svg.path.Path(*path) for path in paths]


class Corner(object):
  def __init__(self, paths, index):
    self.index = index
    (i, j) = index
    self.path = paths[i]
    self.point = paths[i][j].start
    (self.tangent1, self.tangent2) = self._get_tangents()
    self.angle = self._get_angle(self.tangent1, self.tangent2)

  def bridge(self, other):
    '''
    Returns true if a stroke continues from this corner point to the other.
    Internally, this function builds a 7-dimensional feature vector and then
    calls a classifier. The 7 features are:
      features[0]: The angle between the edge in and the bridge
      features[1]: The angle between the bridge and the edge out
      features[2]: The angle between the cross stroke out and the bridge
      features[3]: The angle between the cross stroke in and the bridge
      features[4]: The angle at this corner
      features[5]: The angle at the other corner
      features[6]: The length of the bridge

    At an ideal bridge, features[0] and features[1] should be very close to 0,
    meaning that the stroke can continue smoothly from this corner to the other.
    features[2] + features[3] is close to pi, meaning that the stroke in
    is straight, and features[6], the distance, is small.

    This ideal configuration might look like this diagram:

            /  ^
           /  /
        <-O  S--

    where S is this corner and O is the other and the arrows indicate the
    direction of the curve.
    '''
    diff = other.point - self.point
    length = abs(diff)
    if length == 0 or length > MAX_BRIDGE_DISTANCE:
      return False
    # NOTE: These angle features make sense even if points are on different
    # subpaths of the glyph path! Because of our preprocessing, exterior glyph
    # paths are clockwise while interior paths are counter-clockwise, so angle
    # features around a bridge are the same whether or not the two sides of
    # the bridge are on the same path.
    features = (
      self._get_angle(self.tangent1, diff),
      self._get_angle(diff, other.tangent2),
      self._get_angle(diff, self.tangent2),
      self._get_angle(other.tangent1, diff),
      self.angle,
      other.angle,
      length,
    )
    # TODO(skishore): Log this sample and use it to train the classifier.
    result = self._run_classifier(features)
    return result

  def merge_into(self, other):
    '''
    Merges this corner into the other corner, updating the other's data.
    The merged corner takes the position of the sharper corner of the two.
    Because the path curves slightly in the positive direction on average, a
    curve is sharper if its angle is more negative.
    '''
    if self.angle < other.angle:
      other.index = self.index
      other.point = self.point
    other.tangent1 = self.tangent1
    other.angle = other._get_angle(other.tangent1, other.tangent2)

  def should_merge(self, other):
    '''
    Returns true if this corner point is close enough to the next one that
    they should be combined into one corner point. Note that the next corner
    should have an index that occurs soon after this corner's.
    '''
    assert other.index[0] == self.index[0], \
           'merge called for corners on different curves!'
    if abs(other.point - self.point) > MAX_CORNER_MERGE_DISTANCE:
      return False
    distance = 0
    j = self.index[1]
    while j != other.index[1]:
      distance += abs(self.path[j].end - self.path[j].start)
      j = (j + 1) % len(self.path)
    return distance < MAX_CORNER_MERGE_DISTANCE

  def _get_angle(self, vector1, vector2):
    ratio = vector2/vector1 if vector1 else 0
    return math.atan2(ratio.imag, ratio.real)

  def _get_tangents(self):
    segment1 = self.path[self.index[1] - 1]
    tangent1 = segment1.end - segment1.start
    if (type(segment1) == svg.path.QuadraticBezier and
        abs(segment1.end - segment1.control) > MIN_CORNER_TANGENT_DISTANCE):
      tangent1 = segment1.end - segment1.control
    segment2 = self.path[self.index[1]]
    tangent2 = segment2.end - segment2.start
    if (type(segment2) == svg.path.QuadraticBezier and
        abs(segment2.control - segment2.start) > MIN_CORNER_TANGENT_DISTANCE):
      tangent2 = segment2.control - segment2.start
    return (tangent1, tangent2)

  def _run_classifier(self, features):
    # TODO(skishore): Replace these inequalities with a trained classifier.
    alignment = abs(features[0]) + abs(features[1])
    incidence = abs(features[2] + features[3] + math.pi)
    short = features[6] < MAX_BRIDGE_DISTANCE/2
    clean = alignment < 0.1*math.pi or alignment + incidence < 0.2*math.pi
    cross = all([
      features[0] > 0,
      features[1] > 0,
      features[2] + features[3] < -0.5*math.pi,
    ])
    result = 0
    if features[2] < 0 and features[3] < 0 and (clean or (short and cross)):
      result = (1 if short else 0.75) if clean else 0.5
    return result


class StrokeExtractor(object):
  def __init__(self, name, d):
    self.name = name
    self.messages = []
    self.paths = split_and_orient_path(svg.path.parse_path(d))
    self.corners = self.get_corners()
    self.bridges = self.get_bridges()
    (self.strokes, self.stroke_adjacency) = self.extract_strokes()

  def extract_stroke(self, extracted, start):
    '''
    Given a path, a list of corners, and an adjacency list representation of
    bridges between then, extract a stroke that starts at the given index
    and add the indices of all elements on that stroke to extracted.

    This method will return a pair (path, corners), where the first element is
    an svg.path.Path object representing the stroke and the second is a list of
    corners that appear on that stroke. The corners list will have duplicates if
    the stroke loops back on itself, which indicates a mistake somewhere.

    This method will fail if, when following edges the the initial path element,
    we cross a bridge and enter a stroke that has already been extracted. If so,
    the path we return will be None.

    NOTE: We deliberately avoid using bridge directionality in this algorithm
    so that we can handle manually added bridges.
    '''
    current = start
    corners = []
    path = svg.path.Path()
    visited = set()

    def advance(index):
      return (index[0], (index[1] + 1) % len(self.paths[index[0]]))

    def angle(index, bridge):
      tangent = self.corners[index].tangent1
      ratio = (self.corners[bridge].point - self.corners[index].point)/tangent
      return abs(math.atan2(ratio.imag, ratio.real))

    while True:
      # Add the current stroke element to the path and advance along it.
      path.append(self.paths[current[0]][current[1]])
      visited.add(current)
      current = advance(current)
      # If there is a bridge aligned with the stroke element that we advanced
      # over, advance over that bridge as well. If there are multiple bridges,
      # choose the one that is most aligned.
      if current in self.bridges:
        next = sorted(self.bridges[current], key=lambda x: angle(current, x))[0]
        corners.extend([self.corners[current], self.corners[next]])
        path.append(svg.path.Line(
            start=self.corners[current].point, end=self.corners[next].point))
        current = next
      # Check if we either closed the loop or hit an already extracted stroke.
      if current == start:
        extracted.update(visited)
        return (path, corners)
      elif current in visited or current in extracted:
        return (None, [])

  def extract_strokes(self):
    '''
    Returns a pair (strokes, stroke_adjacency), where the first element is a
    list of svg.path.Path objects that decompose this glyph into strokes and the
    second is an adjacency-list representation of the indices of strokes which
    share corner points.

    This method will log if some path elements do not appear on any stroke.
    '''
    extracted = set()
    strokes = []
    stroke_adjacency = collections.defaultdict(set)
    corner_adjacency = collections.defaultdict(set)
    for i, path in enumerate(self.paths):
      for j, element in enumerate(path):
        index = (i, j)
        if index not in extracted:
          (stroke, corners) = self.extract_stroke(extracted, index)
          if stroke is None:
            self.log('Stroke extraction missed some path elements!')
            continue
          stroke_index = len(strokes)
          strokes.append(stroke)
          corner_indices = set(corner.index for corner in corners)
          if len(corner_indices) < len(corners):
            self.log('Stroke {0} is self-intersecting!'.format(stroke_index))
          for corner_index in corner_indices:
            for other_index in corner_adjacency[corner_index]:
              stroke_adjacency[other_index].add(stroke_index)
              stroke_adjacency[stroke_index].add(other_index)
            corner_adjacency[corner_index].add(stroke_index)
    return (strokes, stroke_adjacency)

  def get_bridges(self):
    '''
    Returns an adjacency list of bridges. A bridge is a pair of corner indices
    through which a stroke continues. The adjacency list is undirected: for any
    two corner indices a and b, if b in result[a], a in result[b].
    '''
    # Collect bridge candidates scored by our bridge classifier.
    candidates = []
    for corner in self.corners.itervalues():
      for other in self.corners.itervalues():
        confidence = corner.bridge(other)
        if confidence > 0:
          candidates.append((confidence, corner.index, other.index))
    candidates.sort(reverse=True)
    # Add bridges to the set of bridges in order of decreasing confidence.
    # However, we do NOT add bridges that would either a) form a triangle with
    # an existing bridge, or b) that are long and should be multiple bridges.
    bridges = set()
    for (confidence, index1, index2) in candidates:
      other1 = set(b for (a, b) in bridges if a == index1)
      other2 = set(b for (a, b) in bridges if a == index2)
      if (other1.intersection(other2) or
          self.should_split_bridge((index1, index2))):
        continue
      bridges.add((index1, index2))
      bridges.add((index2, index1))
    # Convert the result to an adjacency list. Having more than two bridges at
    # any given corner results in a warning.
    result = collections.defaultdict(list)
    for (index1, index2) in bridges:
      result[index1].append(index2)
      if len(result[index1]) == 3:
        self.log('More than two bridges at corner {0}'.format(
            self.corners[index1].point))
    return result

  def get_corners(self):
    '''
    Returns a dict mapping indices to corners at that index. Each corner is a
    point on the curve where the path makes a sharp negative angle. Since the
    path has a small positive average angle, it is non-convex at these corners.
    '''
    result = {}
    for i, path in enumerate(self.paths):
      candidates = [Corner(self.paths, (i, j)) for j in xrange(len(path))]
      j = 0
      while j < len(candidates):
        next_j = (j + 1) % len(candidates)
        if candidates[j].should_merge(candidates[next_j]):
          candidates[j].merge_into(candidates[next_j])
          candidates.pop(j)
        else:
          j += 1
      for corner in filter(lambda x: x.angle < -MIN_CORNER_ANGLE, candidates):
        result[corner.index] = corner
    return result

  def log(self, message):
    self.messages.append(message)

  def should_split_bridge(self, bridge):
    '''
    Returns true if there is some corner that is too close to the middle of the
    given bridge. When this occurs, the gap between these indices should usually
    be spanned by multiple bridges instead.
    '''
    (index1, index2) = bridge
    base = self.corners[index1].point
    diff = self.corners[index2].point - base
    for corner in self.corners.itervalues():
      if corner.index in bridge:
        continue
      t = ((corner.point.real - base.real)*diff.real +
           (corner.point.imag - base.imag)*diff.imag)/(abs(diff)**2)
      distance_to_line = abs(self.corners[index1].point + t*diff - corner.point)
      if 0 < t < 1 and distance_to_line < MAX_CORNER_MERGE_DISTANCE:
        return True
    return False
