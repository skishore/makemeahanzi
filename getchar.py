#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import collections
import math
import os
import random
import svg.path
import sys

SCALE = 0.16
SVG_DIR = 'derived'
TRANSFORM = 'scale({0:.2g}, -{0:0.2g}) translate(0, -900)'.format(SCALE)

# Constants controlling our stroke extraction algorithm.
MAX_BRIDGE_DISTANCE = 128
MAX_CORNER_MERGE_DISTANCE = 16
MIN_CORNER_ANGLE = 0.1*math.pi
MIN_CORNER_TANGENT_DISTANCE = 4


class Corner(object):
  def __init__(self, paths, index):
    self.index = index
    (i, j) = index
    self.path = paths[i]
    self.point = paths[i][j].end
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

            /  /
           /  /
        --S  O--

    where S is this corner and O is the other.
    '''
    diff = other.point - self.point
    length = abs(diff)
    if length == 0 or length > MAX_BRIDGE_DISTANCE:
      return False
    # NOTE: These angle features make sense even if points are on different
    # subpaths of the glyph path! In a TTF font, exterior paths are recorded
    # counter-clockwise while interior paths are clockwise, so angle features
    # at a bridge are the same whether or not the glyph is simply connected.
    features = (
      self._get_angle(self.tangent1, diff),
      self._get_angle(diff, other.tangent2),
      self._get_angle(diff, self.tangent2),
      self._get_angle(other.tangent1, diff),
      self.angle,
      other.angle,
      length,
    )
    result = self._run_classifier(features)
    # Log this sample so that we can later use it as training data.
    print (self.point, other.point, features, result)
    return result

  def merge(self, other):
    '''
    Merges this corner with the other corner, updating the other's data.
    The merged corner takes the position of the sharper corner of the two.
    '''
    if abs(self.angle) > abs(other.angle):
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
      j = (j + 1) % len(self.path)
      distance += abs(self.path[j].end - self.path[j].start)
    return distance < MAX_CORNER_MERGE_DISTANCE

  def _get_angle(self, vector1, vector2):
    ratio = vector1/vector2 if vector2 else 0
    return math.atan2(ratio.imag, ratio.real)

  def _get_tangents(self):
    segment1 = self.path[self.index[1]]
    tangent1 = segment1.end - segment1.start
    if (type(segment1) == svg.path.QuadraticBezier and
        abs(segment1.control - segment1.end) > MIN_CORNER_TANGENT_DISTANCE):
      tangent1 = segment1.end - segment1.control
    segment2 = self.path[(self.index[1] + 1) % len(self.path)]
    tangent2 = segment2.end - segment2.start
    if (type(segment2) == svg.path.QuadraticBezier and
        abs(segment2.control - segment2.start) > MIN_CORNER_TANGENT_DISTANCE):
      tangent2 = segment2.control - segment2.start
    return (tangent1, tangent2)

  def _run_classifier(self, features):
    # TODO(skishore): Replace this set of inequalities with a machine-learned
    # classifier such as a neural net.
    alignment = abs(features[0]) + abs(features[1])
    incidence = abs(abs(features[2]) + abs(features[3]) - math.pi)
    short = features[6] < MAX_BRIDGE_DISTANCE/2
    clean = alignment < 0.1*math.pi or alignment + incidence < 0.2*math.pi
    cross = all([
      features[0]*features[1] > 0,
      features[0]*features[2] < 0,
      alignment < math.pi,
      abs(features[2]) + abs(features[3]) > 0.5*math.pi,
    ])
    result = 0
    if features[2]*features[3] > 0 and (clean or (short and cross)):
      result = (1 if short else 0.75) if clean else 0.5
    return result


def augment_glyph(glyph):
  names = [token for token in glyph.split() if 'glyph-name' in token]
  print '\n# {0}'.format(names[0] if names else 'glyph-name="unknown"')
  path = svg.path.parse_path(get_svg_path_data(glyph))
  path = svg.path.Path(
      *[element for element in path if element.start != element.end])
  assert path, 'Got empty path for glyph:\n{0}'.format(glyph)
  paths = split_and_orient_path(path)
  corners = get_corners(paths)
  bridges = get_bridges(corners)
  (strokes, failed) = extract_strokes(paths, corners, bridges)
  if failed:
    print '# WARNING: stroke extraction failed for {0}'.format(
        names[0] if names else 'glyph-name="unknown"')
  # Actually augment the glyph with stroke-aligned cuts.
  result = []
  rand256 = lambda: random.randint(0,255)
  for stroke in strokes:
    result.append('<path fill="{0}" d="{1}" />'.format(
        '#%02X%02X%02X' % (rand256(), rand256(), rand256()), stroke.d()))
  for path in paths:
    for element in path:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="blue" stroke="blue"/>'.format(
              int(element.end.real), int(element.end.imag)))
  for corner in corners.itervalues():
    result.append(
        '<circle cx="{0}" cy="{1}" r="4" fill="red" stroke="red" '
        'data-angle="{2}"/>'.format(
            int(corner.point.real), int(corner.point.imag), corner.angle))
  for (index1, index2) in bridges:
    if index1 < index2:
      result.append(
          '<line x1="{0}" y1="{1}" x2="{2}" y2="{3}" style="{4}"/>'.format(
              int(corners[index1].point.real), int(corners[index1].point.imag),
              int(corners[index2].point.real), int(corners[index2].point.imag),
              'stroke:white;stroke-width:8'))
  return result

def split_and_orient_path(path):
  '''
  Takes a non-empty svg.path.Path object that may contain multiple closed.
  Returns a list of svg.path.Path objects that are all minimal closed curve.

  The returned paths will be oriented as a TTF glyph should be: exterior curves
  will be counter-clockwise and interior curves will be clockwise.
  '''
  paths = [[path[0]]]
  for element in path[1:]:
    if element.start != paths[-1][-1].end:
      paths.append([])
    paths[-1].append(element)
  # Determine if this glyph is oriented in the wrong direction by computing the
  # area of each glyph. The glyph with maximum |area| should have positive area,
  # because it must be an exterior path.
  def area(path):
    return sum(int(x.end.real - x.start.real)*int(x.end.imag + x.start.imag)
               for x in path)
  def reverse(path):
    for element in path:
      (element.start, element.end) = (element.end, element.start)
    return reversed(path)
  areas = [area(path) for path in paths]
  max_area = max((abs(area), area) for area in areas)[1]
  if max_area < 0:
    paths = map(reverse, paths)
  return [svg.path.Path(*path) for path in paths]

def extract_stroke(paths, corners, adjacency, extracted, start):
  current = start
  result = svg.path.Path()
  visited = set()

  def advance(index):
    return (index[0], (index[1] + 1) % len(paths[index[0]]))

  def angle(index, bridge):
    tangent = corners[index].tangent2
    ratio = (corners[bridge].point - corners[index].point)/tangent
    return abs(math.atan2(ratio.imag, ratio.real))

  while True:
    result.append(paths[current[0]][current[1]])
    visited.add(current)
    if current in adjacency:
      next = sorted(adjacency[current], key=lambda x: angle(current, x))[0]
      result.append(svg.path.Line(
          start=corners[current].point, end=corners[next].point))
      current = next
    current = advance(current)
    if current == start:
      extracted.update(visited)
      return result
    elif current in visited or current in extracted:
      return False

def extract_strokes(paths, corners, bridges):
  adjacency = collections.defaultdict(list)
  for (index1, index2) in bridges:
    adjacency[index1].append(index2)
  extracted = set()
  result = []
  failed = False
  for i, path in enumerate(paths):
    for j, element in enumerate(path):
      index = (i, j)
      if index not in extracted:
        stroke = extract_stroke(paths, corners, adjacency, extracted, index)
        if stroke:
          result.append(stroke)
        else:
          failed = True
  return (result, failed)

def get_bridges(corners):
  candidates = []
  for corner in corners.itervalues():
    for other in corners.itervalues():
      confidence = corner.bridge(other)
      if confidence > 0:
        candidates.append((confidence, corner.index, other.index))
  candidates.sort(reverse=True)
  result = set()
  for (confidence, index1, index2) in candidates:
    other1 = set(b for (a, b) in result if a == index1)
    other2 = set(b for (a, b) in result if a == index2)
    if other1.intersection(other2) or should_split(corners, index1, index2):
      continue
    result.add((index1, index2))
    result.add((index2, index1))
  return result

def get_corners(paths):
  result = {}
  for i, path in enumerate(paths):
    corners = [Corner(paths, (i, j)) for j in xrange(len(path))]
    j = 0
    while j < len(corners):
      if corners[j].should_merge(corners[(j + 1) % len(corners)]):
        corners[j].merge(corners[(j + 1) % len(corners)])
        corners.pop(j)
      else:
        j += 1
    corners = filter(lambda x: abs(x.angle) > MIN_CORNER_ANGLE, corners)
    for corner in corners:
      result[corner.index] = corner
  return result

def get_svg_path_data(glyph):
  left = ' d="'
  start = max(glyph.find(left), glyph.find(left.replace(' ', '\n')))
  assert start >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  end = glyph.find('"', start + len(left))
  assert end >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  return glyph[start + len(left):end].replace('\n', ' ')

def should_split(corners, index1, index2):
  start = corners[index1].point
  diff = corners[index2].point - start
  for corner in corners.itervalues():
    if corner.index in (index1, index2):
      continue
    t = ((corner.point.real - start.real)*diff.real +
         (corner.point.imag - start.imag)*diff.imag)/(abs(diff)**2)
    distance_to_line = abs(corners[index1].point + t*diff - corner.point)
    if 0 < t < 1 and distance_to_line < MAX_CORNER_MERGE_DISTANCE:
      return True
  return False


if __name__ == '__main__':
  assert len(sys.argv) > 1, 'Usage: ./getchar.py <unicode_codepoint>+'
  svgs = [file_name for file_name in os.listdir(SVG_DIR)
          if file_name.endswith('.svg') and not file_name.startswith('.')]
  glyphs = []
  for file_name in svgs:
    glyphs.append([])
    with open(os.path.join(SVG_DIR, file_name)) as file:
      data = file.read()
    for codepoint in sys.argv[1:]:
      index = data.find('unicode="&#x{0};"'.format(codepoint))
      if index < 0:
        print >> sys.stderr, '{0}: missing {1}'.format(file_name, codepoint)
        continue
      (left, right) = ('<glyph', '/>')
      (start, end) = (data.rfind(left, 0, index), data.find(right, index))
      if start < 0 or end < 0:
        print >> sys.stderr, '{0}: malformed {1}'.format(file_name, codepoint)
        continue
      glyphs[-1].append(data[start:end + len(right)])

  with open('chars.html', 'w') as f:
    f.write('<!DOCTYPE html>\n  <html>\n    <body>\n')
    for row in glyphs:
      f.write('      <div>\n')
      for glyph in row:
        size = int(1024*SCALE)
        f.write('        <svg width="{0}" height="{0}">\n'.format(size))
        f.write('          <g transform="{0}">\n'.format(TRANSFORM))
        f.write(glyph.replace('<glyph', '<path') + '\n')
        for extra in augment_glyph(glyph):
          f.write(extra + '\n')
        f.write('          </g>\n')
        f.write('        </svg>\n')
      f.write('      </div>\n')
    f.write('    </body>\n  </html>')
