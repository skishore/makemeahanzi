"use strict";

let stage = undefined;
let voronoi = undefined;

const findLongestShortestPath = (adjacency, vertices, node) => {
  const path = findPathFromFurthestNode(adjacency, vertices, node);
  return findPathFromFurthestNode(adjacency, vertices, path[0]);
}

const findPathFromFurthestNode = (adjacency, vertices, node, visited) => {
  visited = visited || {};
  visited[node] = true;
  let result = [];
  result.distance = 0;
  for (let neighbor of adjacency[node] || []) {
    if (!visited[neighbor]) {
      const candidate = findPathFromFurthestNode(
          adjacency, vertices, neighbor, visited);
      candidate.distance +=
          Math.sqrt(Point.distance2(vertices[node], vertices[neighbor]));
      if (candidate.distance > result.distance) {
        result = candidate;
      }
    }
  }
  result.push(node);
  return result;
}

const findStrokeMedian = (stroke) => {
  const paths = svg.convertSVGPathToPaths(stroke);
  assert(paths.length === 1, `Got stroke with multiple loops: ${stroke}`);
  const polygon = svg.getPolygonApproximation(paths[0], 16);

  voronoi = voronoi || new Voronoi;
  const sites = polygon.map((point) => ({x: point[0], y: point[1]}));
  const bounding_box = {xl: -1024, xr: 1024, yt: -1024, yb: 1024};
  const diagram = voronoi.compute(sites, bounding_box);

  diagram.vertices.map((x, i) => {
    x.include = svg.polygonContainsPoint(polygon, [x.x, x.y]);
    x.index = i;
  });
  const vertices = diagram.vertices.map((x) => [x.x, x.y].map(Math.round));
  const edges = diagram.edges.map((x) => [x.va.index, x.vb.index]).filter(
      (x) => diagram.vertices[x[0]].include && diagram.vertices[x[1]].include);
  voronoi.recycle(diagram);

  assert(edges.length > 0);
  const adjacency = {};
  for (let edge of edges) {
    adjacency[edge[0]] = adjacency[edge[0]] || [];
    adjacency[edge[0]].push(edge[1]);
    adjacency[edge[1]] = adjacency[edge[1]] || [];
    adjacency[edge[1]].push(edge[0]);
  }
  const root = edges[0][0];
  const path = findLongestShortestPath(adjacency, vertices, root);
  const points = path.map((i) => vertices[i]);

  const tolerance = 4;
  const simple = simplify(points.map((x) => ({x: x[0], y: x[1]})), tolerance);
  return simple.map((x) => [x.x, x.y]);
}

const selectPrincipalLine = (medians) => {
  const starts = medians.map((x) => [x[0], x[x.length - 1]]);
  const ends = medians.map((x) => [x[x.length - 1], x[0]]);
  const endpoints = starts.concat(ends);
  let best_pair = undefined;
  let best_score = 0;
  for (let endpoint1 of endpoints) {
    for (let endpoint2 of endpoints) {
      const difference = Point.subtract(endpoint1[0], endpoint2[0]);
      const score = Math.min(Math.abs(difference[0]), Math.abs(difference[1]));
      if (score > best_score) {
        [best_pair, best_score] = [[endpoint1, endpoint2], score];
      }
    }
  }
  assert(best_pair);
  return best_pair;
}

stages.order = class OrderStage extends stages.AbstractStage {
  constructor(glyph) {
    super('order');
    this.strokes = glyph.stages.strokes;
    this.medians = this.strokes.map(findStrokeMedian);
    this.principal = selectPrincipalLine(this.medians);
    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    Session.set('stages.order.components',
                decomposition_util.collectComponents(tree));
    stage = this;
  }
  onAllComponentsReady() {
    console.log(Session.get('stages.order.components'));
  }
  refreshUI() {
    const to_path = (x) => ({d: x, fill: 'gray', stroke: 'gray'});
    Session.set('stage.paths', this.strokes.map(to_path));
    const colors = this.colors;
    const points = [];
    const to_point = (x, i) => {
      const color = colors[i % colors.length];
      return {cx: x[0], cy: x[1], fill: color, stroke: color};
    }
    this.medians.map((x, i) => x.map((y) => points.push(to_point(y, i))));
    Session.set('stage.points', points);
    Session.set('stage.lines', [{
      x1: this.principal[0][0][0],
      y1: this.principal[0][0][1],
      x2: this.principal[1][0][0],
      y2: this.principal[1][0][1],
      stroke: 'black',
    }]);
  }
}

Meteor.startup(() => {
  Tracker.autorun(() => {
    const components = Session.get('stages.order.components') || [];
    Meteor.subscribe('getAllGlyphs', components);
  });
  Tracker.autorun(() => {
    const components = Session.get('stages.order.components') || [];
    const found = components.filter((x) => Glyphs.findOne({character: x}));
    if (found.length === components.length &&
        Session.get('stage.type') === 'order') {
      stage.onAllComponentsReady();
    }
  });
});
