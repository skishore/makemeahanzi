#!/usr/bin/python
'''
Extracts one or more characters from each of the svg fonts in the SVG directory
and packages them into a 'chars.html' output file.
'''
import os
import random
import shapely.geometry
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
  print '\n# {0}'.format(name)
  extractor = stroke_extractor.StrokeExtractor(name, d)
  for message in extractor.messages:
    print '# {0}'.format(message)
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
  # Switch to an augmentation that attempts to find a medial line approximation.
  polygons = get_polygon_approximation(extractor.strokes, 64)
  medians = find_medians(polygons, 256)
  result = []
  for polygon in polygons:
    for point in polygon.coords:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="red" stroke="red"/>'.format(
              int(point[0]), int(point[1])))
  for median in medians:
    color = '#%02X%02X%02X' % (rand256(), rand256(), rand256())
    for point in median:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="{2}" stroke="{2}"/>'.format(
              int(point.real), int(point.imag), color))
  return result


def convert_to_complex(pair):
  return pair[0] + 1j*pair[1]

def convert_to_pair(complex):
  return (int(complex.real), int(complex.imag))

def find_medians(polygons, max_distance):
  result = []
  for polygon in polygons.geoms:
    result.append([])
    for i in xrange(len(polygon.coords) - 1):
      # Compute the midpoint of this polygon edge and then construct a ray that
      # starts and that midpoint and is perpendicular to the segment.
      point1 = convert_to_complex(polygon.coords[i])
      point2 = convert_to_complex(polygon.coords[i + 1])
      midpoint = (point1 + point2)/2
      diff = point2 - point1
      if not diff:
        continue
      left = 1j*max_distance*diff/abs(diff)
      ray = shapely.geometry.LineString(
          map(convert_to_pair, [midpoint, midpoint + left]))
      # Compute the closest point of intersection between that ray and the rest
      # of the approximating polygon. Ignore the midpoint intersection.
      shapely_midpoint = shapely.geometry.Point(*convert_to_pair(midpoint))
      (best, best_distance) = (None, 0)
      intersection = [polygons.intersection(ray)]
      if (type(intersection[0]) in
          (shapely.geometry.GeometryCollection, shapely.geometry.MultiPoint)):
        intersection = list(intersection[0])
      for element in intersection:
        if type(element) != shapely.geometry.Point:
          continue
        distance = shapely_midpoint.distance(element)
        if distance < 4:
          continue
        if best is None or distance < best_distance:
          (best, best_distance) = (element, distance)
      if best is None:
        continue
      result[-1].append((midpoint + best.x + 1j*best.y)/2)
  return result

def get_polygon_approximation(paths, error):
  coordinates = []
  for path in paths:
    coordinates.append([])
    for i, element in enumerate(path):
      num_interpolating_points = max(int(element.length()/error), 1)
      for i in xrange(num_interpolating_points):
        coordinates[-1].append(convert_to_pair(
            element.point(1.0*i/num_interpolating_points)))
    coordinates[-1].append(convert_to_pair(path[0].start))
  return shapely.geometry.MultiLineString(coordinates)


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
