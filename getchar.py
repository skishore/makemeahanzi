#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import os
import svg.path
import sys

SCALE = 0.16
SVG_DIR = 'derived'
TRANSFORM = 'scale({0:.2g}, -{0:0.2g}) translate(0, -900)'.format(SCALE)

# Constants controlling our stroke extraction algorithm.
MAX_CROSSING_DISTANCE = 64


def augment_glyph(glyph):
  path = svg.path.parse_path(get_svg_path_data(glyph))
  assert path, 'Got empty path for glyph:\n{0}'.format(glyph)
  # Actually augment the glyph. For now, we draw a line between pairs of curve
  # endpoints that are sufficiently close.
  result = []
  for i, element in enumerate(path):
    for j, neighbor in enumerate(path):
      if j == i or j + 1 % len(path) == i or j == i + 1 % len(path):
        continue
      if abs(element.start - neighbor.start) < MAX_CROSSING_DISTANCE:
        result.append(
            '<line x1="{0}" y1="{1}" x2="{2}" y2="{3}" style="{4}"/>'.format(
                int(element.start.real), int(element.start.imag),
                int(neighbor.start.real), int(neighbor.start.imag),
                'stroke:red;stroke-width:4'))
  return result

def break_path(path):
  subpaths = [[path[0]]]
  for element in path[1:]:
    if element.start == element.end:
      continue
    if element.start != subpaths[-1][-1].end:
      subpaths.append([])
    subpaths[-1].append(element)
  return [svg.path.Path(*subpath) for subpath in subpaths]

def get_svg_path_data(glyph):
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
