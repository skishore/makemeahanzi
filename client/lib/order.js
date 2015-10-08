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
  const polygon = findApproximatePolygon(path, 32);
  return polygon;
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
