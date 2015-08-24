#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import math
import os
import random
import sys

import stroke_extractor


SCALE = 0.16
SVG_DIR = 'derived'
TRANSFORM = 'scale({0:.2g}, -{0:0.2g}) translate(0, -900)'.format(SCALE)


def augment_glyph(glyph):
  '''
  Takes an HTML SVG object and returns a list of addition SVG elements that
  should be added to the glyph to show diagnostic data for our algorithm.
  '''
  name = get_html_attribute(glyph, 'glyph-name')
  d = get_html_attribute(glyph, 'd')
  assert name and d, 'Missing glyph-name or d for glyph:\n{0}'.format(glyph)
  extractor = stroke_extractor.StrokeExtractor(name, d)
  # We augment the glyph with three types of information:
  #  - The extracted strokes. Each one is drawn in a random color.
  #  - The endpoints of the original paths, with corners in red, others in blue.
  #  - The detected bridges, line segments drawn in white.
  result = []
  rand256 = lambda: random.randint(0,255)
  for stroke in extractor.strokes:
    result.append('<path fill="{0}" d="{1}" />'.format(
        '#%02X%02X%02X' % (rand256(), rand256(), rand256()), stroke.d()))
  for path in extractor.paths:
    for element in path:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="blue" stroke="blue"/>'.format(
              int(element.end.real), int(element.end.imag)))
  corners = extractor.corners
  for corner in corners.itervalues():
    result.append(
        '<circle cx="{0}" cy="{1}" r="4" fill="red" stroke="red" '
        'data-angle="{2}"/>'.format(
            int(corner.point.real), int(corner.point.imag), corner.angle))
  for index1 in extractor.bridges:
    for index2 in extractor.bridges[index1]:
      if index1 > index2:
        continue
      result.append(
          '<line x1="{0}" y1="{1}" x2="{2}" y2="{3}" style="{4}"/>'.format(
              int(corners[index1].point.real), int(corners[index1].point.imag),
              int(corners[index2].point.real), int(corners[index2].point.imag),
              'stroke:white;stroke-width:8'))
  return result


def get_html_attribute(glyph, attribute):
  '''
  Takes an HTML SVG object and returns the path data from the "d" field.
  '''
  left = ' {0}="'.format(attribute)
  start = max(glyph.find(left), glyph.find(left.replace(' ', '\n')))
  end = glyph.find('"', start + len(left))
  assert start >= 0 and end >= 0, \
      'Glyph missing {0}=".*" block:\n{1}'.format(attribute, repr(glyph))
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
  # Construct an HTML file that includes the extracted glyphs, along with
  # diagnostic data for our stroke extraction algorithm.
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
