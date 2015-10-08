"use strict";

const convertSegmentToBezier = (segment) => {
  const start = {x: segment.start[0], y: segment.start[1]};
  if (!segment.control) {
    segment.control = [(segment.start[0] + segment.end[0])/2,
                       (segment.start[1] + segment.end[1])/2];
  }
  const control = {x: segment.control[0], y: segment.control[1]};
  const end = {x: segment.end[0], y: segment.end[1]};
  return new Bezier([start, control, end]);
}

const findApproximatePolygon = (path, error) => {
  assert(error);
  const paths = svg.convertSVGPathToPaths(path);
  assert(paths.length === 1);
  const result = [];
  for (let segment of paths[0]) {
    const bezier = convertSegmentToBezier(segment);
    const n = Math.max(bezier.length()/error, 1);
    const points = bezier.getLUT(n);
    points.map((point) => result.push([point.x, point.y]));
  }
  return result;
}

const findPathMedian = (path) => {
  const result = [];
  const polygon = findApproximatePolygon(path, 32);
  for (let i = 0; i < polygon.length; i++) {
    const point1 = polygon[i];
    const point2 = polygon[(i + 1) % polygon.length];
    // For each side of the polygon, we compute its midpoint and then consider
    // the portion of its perpendicular bisector that extends into the polygon.
    // Crucially, we are using the orientation assumption here: the polygon
    // should be oriented in the counter-clockwise direction.
    //  - dot measures which side of the bisector we're on. If dot is greater
    //    than dotmid, we are on the same side of the bisector as point2.
    //  - sid measures whether a point is inside or outside the polygon. If sid
    //    is greater than sidmid, we are inside the polygon.
    const midpoint = Point.midpoint(point1, point2);
    const diff = Point.subtract(point2, point1);
    const dot = (x) => diff[0]*x[0] + diff[1]*x[1];
    const sid = (x) => diff[0]*x[1] - diff[1]*x[0];
    const dotmid = dot(midpoint);
    const sidmid = sid(midpoint);
    // For each other polygon segment, we compute the intersection of the
    // perpendicular bisector with that segment, and track the closest one.
    let best = undefined;
    let best_distance = Infinity;
    let best_tangent = undefined;
    for (let j = 0; j < polygon.length; j++) {
      if (j === i) continue;
      let intersection = undefined;
      const other1 = polygon[j];
      const other2 = polygon[(j + 1) % polygon.length];
      const dot1 = dot(other1) - dotmid;
      const dot2 = dot(other2) - dotmid;
      if (dot1 === 0 && dot2 === 0) {
        if (Point.distance2(other1, midpoint) >
            Point.distance2(other2, midpoint)) {
          intersection = other2;
        } else {
          intersection = other1;
        }
      } else if (Math.sign(dot1) === Math.sign(dot2)) {
        continue;
      } else {
        const t = dot1/(dot1 - dot2);
        intersection = [(1 - t)*other1[0] + t*other2[0],
                        (1 - t)*other1[1] + t*other2[1]];
      }
      const distance = Math.sqrt(Point.distance2(intersection, midpoint));
      if (distance < best_distance && sid(intersection) > sidmid) {
        best = intersection;
        best_distance = distance;
        best_tangent = Point.subtract(other2, other1);
      }
    }
    // If the perpendicular bisector intersects the segment opposite this one,
    // we compute a point between the midpoint and the point of intersection
    // that we want on the median.
    //
    // This point is NOT the midpoint of the midpoint and intersection. If this
    // segment is not parallel to the opposite segment, that midpoint could be
    // far from the median. Instead, we compute the angle bisector of the two
    // segments and find its intersection with the perpendicular bisector.
    if ((best_distance > 128) || (diff[0] === 0 && diff[1] === 0) ||
        (best_tangent[0] === 0 && best_tangent[1] === 0)) {
      continue;
    }
    const angle1 = Math.atan2(diff[1], diff[0]);
    const angle2 = Math.atan2(best_tangent[1], best_tangent[0]);
    const cos = -Math.cos(Angle.subtract(angle2, angle1));
    const t = cos/(1 + cos);
    result.push([(1 - t)*midpoint[0] + t*best[0],
                 (1 - t)*midpoint[1] + t*best[1]]);
  }
  return result;
}

stages.order = class OrderStage extends stages.AbstractStage {
  constructor(glyph) {
    super('order');
    this.strokes = glyph.stages.strokes;
    this.medians = this.strokes.map(findPathMedian);
  }
  refreshUI() {
    const to_path = (x) => ({d: x, fill: 'gray', stroke: 'black'});
    Session.set('stage.paths', this.strokes.map(to_path));
    const points = [];
    const to_point = (x) => ({cx: x[0], cy: x[1], fill: 'red', stroke: 'red'});
    this.medians.map((x) => x.map((y) => points.push(y)));
    Session.set('stage.points', points.map(to_point));
  }
}
