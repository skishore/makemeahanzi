"use strict";

const findPathMedian = (path) => {
  const result = [];
  const paths = svg.convertSVGPathToPaths(path);
  assert(paths.length === 1, `Got stroke with multiple loops: ${path}`);
  const polygon = svg.getPolygonApproximation(paths[0], 32);
  const voronoi = d3.geom.voronoi(polygon);
  for (let cell of voronoi) {
    const included = cell.map((x) => svg.polygonContainsPoint(polygon, x));
    _.range(cell.length).map((i) => {
      const j = (i + 1) % cell.length;
      if (included[i] && included[j]) {
        result.push([cell[i], cell[j]]);
      }
    });
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
    const to_path = (x) => ({d: x, fill: 'gray', stroke: 'gray'});
    Session.set('stage.paths', this.strokes.map(to_path));
    const colors = this.colors;
    const lines = [];
    const to_line = (x, i) => {
      const c = colors[i % colors.length];
      return {x1: x[0][0], y1: x[0][1], x2: x[1][0], y2: x[1][1], stroke: c};
    }
    this.medians.map((x, i) => x.map((y) => lines.push(to_line(y, i))));
    Session.set('stage.lines', lines);
  }
}
