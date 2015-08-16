#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import os
import sys

SCALE = 0.16
SVG_DIR = 'derived'


class Point(object):
  def __init__(self, x=0, y=0):
    self.x = x
    self.y = y

  def __repr__(self):
    return 'Point({0}, {1})'.format(self.x, self.y)


class StrokeExtractor(object):
  def __init__(self):


class SVGPathDecoder(object):
  NUM_NEXT_POINTS = {'m': 1, 'l': 1, 'q': 2, 't': 1, 'h': 0, 'v': 0, 'z': 0}

  def __init__(self, d):
    self.d = d
    self.index = 0
    self.position = Point(0, 0)
    while self.index < len(d):
      code = self._next_code()
      lower = code.lower()
      if lower not in self.NUM_NEXT_POINTS:
        raise ValueError('Unsupported SVG d code {0} at index {1}:\n{2}'.format(
            code, self.index - 1, self.d))
      next_points = self._get_next_points(code)
      if next_points:
        self.position = next_points[-1]
      if lower == 'm':
        print 'Start:', self.position
      elif lower == 'z':
        print 'End:', self.position

  def _get_next_points(self, code):
    result = []
    lower = code.lower()
    for _ in xrange(self.NUM_NEXT_POINTS.get(lower, 0)):
      result.append(Point(self._next_value(), self._next_value()))
    if lower == 'h':
      result.append(Point(self._next_value(), 0))
    elif lower == 'v':
      result.append(Point(0, self._next_value()))
    if lower == code:
      for point in result:
        point.x += self.position.x
        point.y += self.position.y
    return result

  def _get_next_token(self, name, predicate, max_length=None):
    index = self.index
    max_index = len(self.d)
    if max_length:
      max_index = min(max_index, index + max_length)
    while index < max_index and predicate(self.d[index]):
      index += 1
    result = self.d[self.index:index]
    if not result:
      raise ValueError('Error scanning for {0} at index {1}:\n{2}'.format(
          name, self.index, self.d))
    while index < len(self.d) and self.d[index] == ' ':
      index += 1
    self.index = index
    return result

  def _next_code(self):
    return self._get_next_token('code', lambda x: x.isalpha(), 1)

  def _next_value(self):
    return int(self._get_next_token('value', lambda x: x.isdigit() or x == '-'))


def augment_glyph(glyph):
  decoder = SVGPathDecoder(get_glyph_data(glyph))
  print ''

def get_glyph_data(glyph):
  # Returns a list of SVG path d-values for this glyph's outline. Each of these
  # d values has exactly one close-path 'z' instruction at the end of the path.
  left = ' d="'
  start = max(glyph.find(left), glyph.find(left.replace(' ', '\n')))
  assert start >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  end = glyph.find('"', start + len(left))
  assert end >= 0, 'Glyph missing d=".*" block:\n{0}'.format(repr(glyph))
  return glyph[start + len(left):end].replace('\n', ' ')


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
        augment_glyph(glyph)
        size = int(1024*SCALE)
        f.write('        <svg width="{0}" height="{0}">\n'.format(size))
        f.write('          {0}\n'.format(glyph.replace(
            '<glyph', '<path transform="scale({0:.2g}, -{0:0.2g}) '
            'translate(0, -900)"'.format(SCALE))))
        f.write('        </svg>\n')
      f.write('      </div>\n')
    f.write('    </body>\n  </html>')
