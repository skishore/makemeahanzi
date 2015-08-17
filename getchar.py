#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import collections
import math
import os
import svg.path
import sys

SCALE = 0.16
SVG_DIR = 'derived'
TRANSFORM = 'scale({0:.2g}, -{0:0.2g}) translate(0, -900)'.format(SCALE)

# Constants controlling our stroke extraction algorithm.
MAX_CROSSING_DISTANCE = 128
MAX_CUSP_MERGE_DISTANCE = 15
MIN_CUSP_ANGLE = 0.1*math.pi


class Cusp(object):
  def __init__(self, paths, index):
    self.paths = paths
    self.index = index
    (i, j) = index
    self.point = paths[i][j].end
    (self.tangent1, self.tangent2) = self._get_tangents(self.paths[i], j)
    self.angle = self._get_angle(self.tangent1, self.tangent2)

  def connect(self, other):
    # Returns true if a troke continues from this cusp point to the other.
    if other.index == self.index:
      return False
    if other.index[0] == self.index[0]:
      return self._try_connect(other)
    return max(self._try_connect(other), self._try_connect(other, True))

  def merge(self, other):
    # Returns true if this cusp point is close enough to the next one that
    # they should be combined into one cusp point. If this method returns
    # true, other will be populated with the merged cusp data.
    assert other.index[0] == self.index[0], 'merge called for different paths!'
    if abs(other.point - self.point) > MAX_CUSP_MERGE_DISTANCE:
      return False
    distance = 0
    j = self.index[1]
    path = self.paths[self.index[0]]
    while j != other.index[1]:
      j = (j + 1) % len(path)
      distance += abs(path[j].end - path[j].start)
    if distance > MAX_CUSP_MERGE_DISTANCE:
      return False
    # We should merge. Check which point is the real cusp and update other.
    if abs(self.angle) > abs(other.angle):
      other.index = self.index
      other.point = self.point
    other.tangent1 = self.tangent1
    other.angle = other._get_angle(other.tangent1, other.tangent2)
    return True

  def _get_angle(self, vector1, vector2):
    if not vector1 or not vector2:
      return 0
    ratio = vector1/vector2
    return math.atan2(ratio.imag, ratio.real)

  def _get_tangents(self, path, index):
    segment1 = path[index]
    tangent1 = segment1.end - segment1.start
    if (type(segment1) == svg.path.QuadraticBezier and
        segment1.end != segment1.control):
      tangent1 = segment1.end - segment1.control
    segment2 = path[(index + 1) % len(path)]
    tangent2 = segment2.end - segment2.start
    if (type(segment2) == svg.path.QuadraticBezier and
        segment2.control != segment2.end):
      tangent2 = segment2.control - segment2.start
    return (tangent1, tangent2)

  def _try_connect(self, other, reverse=False):
    if other.point == self.point:
      return True
    diff = other.point - self.point
    length = abs(diff)
    if length > MAX_CROSSING_DISTANCE:
      return False
    (other1, other2) = (other.tangent1, other.tangent2)
    if reverse:
      (other1, other2) = (other2, other1)
    features = (
      self._get_angle(self.tangent1, diff),
      self._get_angle(diff, other2),
      self._get_angle(diff, self.tangent2),
      self._get_angle(other1, diff),
      length,
    )
    # TODO(skishore): Replace this set of inequalities with a machine-learned
    # classifier such as a neural net.
    alignment = abs(features[0]) + abs(features[1])
    incidence = abs(abs(features[2]) + abs(features[3]) - math.pi)
    short = length < MAX_CROSSING_DISTANCE/2
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
    print (self.point, other.point, features, result)
    return result


def augment_glyph(glyph):
  names = [token for token in glyph.split() if 'glyph-name' in token]
  print '\n#{0}'.format(names[0] if names else 'glyph-name="unknown"')
  path = svg.path.parse_path(get_svg_path_data(glyph))
  path = svg.path.Path(
      *[element for element in path if element.start != element.end])
  assert path, 'Got empty path for glyph:\n{0}'.format(glyph)
  paths = break_path(path)
  cusps = get_cusps(paths)
  edges = get_edges(cusps)
  # Actually augment the glyph with stroke-aligned cuts.
  result = []
  for cusp in cusps.itervalues():
    result.append(
        '<circle cx="{0}" cy="{1}" r="4" fill="red" stroke="red" '
        'data-angle="{2}"/>'.format(
            int(cusp.point.real), int(cusp.point.imag), cusp.angle))
  for (index1, index2) in edges:
    if index1 < index2:
      result.append(
          '<line x1="{0}" y1="{1}" x2="{2}" y2="{3}" style="{4}"/>'.format(
              int(cusps[index1].point.real), int(cusps[index1].point.imag),
              int(cusps[index2].point.real), int(cusps[index2].point.imag),
              'stroke:white;stroke-width:8'))
  return result

def break_path(path):
  subpaths = [[path[0]]]
  for element in path[1:]:
    if element.start != subpaths[-1][-1].end:
      subpaths.append([])
    subpaths[-1].append(element)
  return [svg.path.Path(*subpath) for subpath in subpaths]

def drop_middle_edges(cusps, edges):
  # If there is a triple of edges (i, j), (j, k), (k, l) where i and l are
  # leaf nodes in the edge graph, drops the edge (j, k). That edge would create
  # a stroke that ends in the middle but that should continue along the other
  # two edges instead.
  adjacency = collections.defaultdict(list)
  for (index1, index2) in edges:
    adjacency[index1].append(index2)
  leaves = set(index for (index, neighbors) in adjacency.iteritems()
               if len(neighbors) == 1)
  edges_to_remove = set()
  for (index1, index2) in edges:
    if (any(neighbor != index2 and neighbor in leaves
            for neighbor in adjacency[index1]) and
        any(neighbor != index1 and neighbor in leaves
            for neighbor in adjacency[index2])):
      edges_to_remove.add((index1, index2))
  return edges.difference(edges_to_remove)

def get_cusps(paths):
  result = {}
  for i, path in enumerate(paths):
    cusps = []
    for j, element in enumerate(path):
      cusp = Cusp(paths, (i, j))
      if abs(cusp.angle) > MIN_CUSP_ANGLE:
        cusps.append(cusp)
    j = 0
    while j < len(cusps):
      if cusps[j].merge(cusps[(j + 1) % len(cusps)]):
        cusps.pop(j)
      else:
        j += 1
    for cusp in cusps:
      result[cusp.index] = cusp
  return result

def get_edges(cusps):
  edges = []
  for cusp in cusps.itervalues():
    for other in cusps.itervalues():
      confidence = cusp.connect(other)
      if confidence > 0:
        edges.append((confidence, cusp.index, other.index))
  edges.sort(reverse=True)
  result = set()
  for (confidence, index1, index2) in edges:
    other1 = set(b for (a, b) in result if a == index1)
    other2 = set(b for (a, b) in result if a == index2)
    if other1.intersection(other2) or should_split(cusps, index1, index2):
      continue
    result.add((index1, index2))
    result.add((index2, index1))
  return drop_middle_edges(cusps, result)

def get_svg_path_data(glyph):
  left = ' d="'
  start = max(glyph.find(left), glyph.find(left.replace(' ', '\n')))
  assert start >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  end = glyph.find('"', start + len(left))
  assert end >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  return glyph[start + len(left):end].replace('\n', ' ')

def should_split(cusps, index1, index2):
  diff = cusps[index2].point - cusps[index1].point
  for cusp in cusps.itervalues():
    if cusp.index in (index1, index2):
      continue
    t = ((cusp.point.real - cusps[index1].point.real)*diff.real +
         (cusp.point.imag - cusps[index1].point.imag)*diff.imag)/(abs(diff)**2)
    distance_to_line = abs(cusps[index1].point + t*diff - cusp.point)
    if 0 < t < 1 and distance_to_line < MAX_CUSP_MERGE_DISTANCE:
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
        f.write(glyph.replace('<glyph', '<path'))
        for extra in augment_glyph(glyph):
          f.write(extra)
        f.write('          </g>\n')
        f.write('        </svg>\n')
      f.write('      </div>\n')
    f.write('    </body>\n  </html>')
