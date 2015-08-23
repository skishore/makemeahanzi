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
  polygons = []
  medians = []
  for path in extractor.strokes:
    polygons.append(get_polygon_approximation(path, 32))
    medians.append(find_median(polygons[-1], 128))
  result = []
  for polygon in polygons:
    for point in polygon:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="red" stroke="red"/>'.format(
              int(point.real), int(point.imag)))
  for median in medians:
    color = '#%02X%02X%02X' % (rand256(), rand256(), rand256())
    for point in median:
      result.append(
          '<circle cx="{0}" cy="{1}" r="4" fill="{2}" stroke="{2}"/>'.format(
              int(point.real), int(point.imag), color))
  return result


def find_median(polygon, max_distance):
  result = []
  for i, point2 in enumerate(polygon):
    # For each polygon edge, we compute its midpoint and consider the portion
    # of its perpendicular bisector that extends into the polygon. We prepare
    # a few functions to compute dot products against this bisector:
    #   - dot measures which side of the bisector points are on. Note that
    #     dot(point) - dotmid is 0 if the point is on the perpendicular
    #     bisector, negative if it is on one side, and positive on the other.
    #   - sid measures whether the point is inside our outside the polygon.
    #     sid(point) - sidmid is 0 if the point is on this segment, positive
    #     if the point is within the polygon, and negative if it is outside.
    point1 = polygon[i - 1]
    midpoint = (point1 + point2)/2
    diff = point2 - point1
    dot = lambda point: diff.real*point.real + diff.imag*point.imag
    sid = lambda point: -diff.imag*point.real + diff.real*point.imag
    dotmid = dot(midpoint)
    sidmid = sid(midpoint)
    # For each other segment, we compute its intersection with the perpendicular
    # bisector and track the closest one overall.
    (best, best_distance, best_tangent) = (None, float('Inf'), None)
    for j, other2 in enumerate(polygon):
      if j == i:
        continue
      other1 = polygon[j - 1]
      (dot1, dot2) = (dot(other1) - dotmid, dot(other2) - dotmid)
      if dot1 == dot2 == 0:
        if abs(other1 - diff) > abs(other2 - diff):
          (other1, other2) = (other2, other1)
        intersection = other1 if dot1 == 0 else other2
      elif cmp(dot1, 0) == cmp(dot2, 0):
        continue
      else:
        t = dot1/(dot1 - dot2)
        intersection = (1 - t)*other1 + t*other2
      distance = abs(intersection - midpoint)
      if sid(intersection) > sidmid and distance < best_distance:
        tangent = other2 - other1
        (best, best_distance, best_tangent) = (intersection, distance, tangent)
    # If the perpendicular bisector intersects a segment opposite this one in
    # the polygon, we compute a point between the midpoint and the intersection
    # point as a candidate for our median line.
    #
    # We do NOT take (midpoint + best)/2. If this segment is not parallel to the
    # opposite segment, that point could be far from the median. Instead, we
    # compute the angle bisector of this segment and the opposte one and find
    # its intersection with the segment (midpoint, best).
    if best is None or best_distance > max_distance or not diff:
      continue
    ratio = best_tangent/diff
    cosine = abs(math.cos(math.atan2(ratio.imag, ratio.real)))
    t = cosine/(1 + cosine)
    result.append((1 - t)*midpoint + t*best)
  return result

def get_polygon_approximation(path, error):
  result = []
  for i, element in enumerate(path):
    num_interpolating_points = max(int(element.length()/error), 1)
    for i in xrange(num_interpolating_points):
      result.append(element.point(1.0*i/num_interpolating_points))
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
