def augment_glyph(strokes):
  '''
  Takes a list of svg.path.Path objects that represent strokes and returns
  additional SVG elements that roughly correspond to a "median", a line that
  runs down the middle of the stroke.
  '''
  polygons = []
  medians = []
  for path in strokes:
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
