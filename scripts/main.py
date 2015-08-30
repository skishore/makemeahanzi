#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and prints data for them to stderr in JSON format. The output data is a list of
dictionaries with the following keys:
  - name: string glyph name
  - d: string SVG path data
  - extractor: stroke data + diagnostics (see stroke_extractor for details)
'''
import argparse
import json
import sys

import stroke_extractor


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
  parser = argparse.ArgumentParser()
  parser.add_argument('-f', '--font', dest='font',
                      help='SVG font to read characters from.', required=True)
  parser.add_argument('-m', '--manual', dest='manual',
                      help='Manual corrections to the algorithm.')
  (options, args) = parser.parse_known_args()
  if options.manual is not None:
    assert len(args) == 1, 'Manual corrections can only apply to one glyph!'
    options.manual = json.loads(options.manual)
  # For each Unicode codepoint among the positional arguments, extract the glyph
  # that corresponds to that codepoint from the given SVG font.
  glyphs = []
  with open(options.font) as font:
    data = font.read()
  for codepoint in args:
    index = data.find('unicode="&#x{0};"'.format(codepoint))
    if index < 0:
      print >> sys.stderr, '{0}: missing {1}'.format(options.font, codepoint)
      continue
    (left, right) = ('<glyph', '/>')
    (start, end) = (data.rfind(left, 0, index), data.find(right, index))
    if start < 0 or end < 0:
      print >> sys.stderr, '{0}: malformed {1}'.format(options.font, codepoint)
      continue
    glyphs.append((codepoint, data[start:end + len(right)]))
  # Print data for each of the extracted glyphs in JSON format.
  result = []
  for (codepoint, glyph) in glyphs:
    name = "U{0}".format(codepoint.upper())
    d = get_html_attribute(glyph, 'd')
    assert name and d, 'Missing glyph-name or d for glyph:\n{0}'.format(glyph)
    extractor = stroke_extractor.StrokeExtractor(name, d, options.manual)
    data = {'name': name, 'd': d, 'extractor': extractor.get_data()}
    result.append(data)
  print json.dumps(result)
