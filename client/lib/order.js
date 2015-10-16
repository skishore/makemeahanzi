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

const alike = (line1, line2) => {
  const diff1 = Point.subtract(line1[0], line1[1]);
  const diff2 = Point.subtract(line2[0], line2[1]);
  // TODO(skishore): We may want a strongler likeness condition here. If we
  // decrease the threshold to 45 degrees, we will reduce the number of
  // alignments between the character and its component that we check, which
  // would speed up our algorithm but potentially cost us recall.
  const angle = Angle.subtract(Point.angle(diff1), Point.angle(diff2));
  return Math.abs(angle) < 0.5*Math.PI;
}

const getMedianEndpoints = (medians) => {
  const starts = medians.map((x) => [x[0], x[x.length - 1]]);
  const ends = medians.map((x) => [x[x.length - 1], x[0]]);
  return starts.concat(ends);
}

const getPossibleAlignments = (character, component) => {
  const principal = getPrincipalLine(getMedianEndpoints(component));
  const endpoints = getMedianEndpoints(character);
  const test = [principal[0][0], principal[1][0]];
  const result = [];
  for (let endpoint1 of endpoints.filter((x) => alike(x, principal[0]))) {
    for (let endpoint2 of endpoints.filter((x) => alike(x, principal[1]))) {
      if (alike([endpoint1[0], endpoint2[0]], test)) {
        result.push([endpoint1, endpoint2]);
      }
    }
  }
  return result;
}

const getPrincipalLine = (endpoints) => {
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
    this.principal = getPrincipalLine(getMedianEndpoints(this.medians));
    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    Session.set('stages.order.components',
                decomposition_util.collectComponents(tree));
    stage = this;
  }
  alignmentToLine(alignment, color) {
    return {
      x1: alignment[0][0][0],
      y1: alignment[0][0][1],
      x2: alignment[1][0][0],
      y2: alignment[1][0][1],
      stroke: color,
    }
  }
  onAllComponentsReady() {
    const components = Session.get('stages.order.components');
    if (components.length === 0) {
      return;
    }
    const glyph = Glyphs.findOne({character: components[0]});
    const medians = glyph.stages.strokes.map(findStrokeMedian);
    const alignments = getPossibleAlignments(this.medians, medians);
    console.log(`Got ${alignments.length} possible alignments.`);
    Meteor.setTimeout(() => {
      const lines = Session.get('stage.lines');
      const display = alignments.map((x) => this.alignmentToLine(x, 'red'));
      Session.set('stage.lines', display.concat([lines[0]]));
    }, 0);
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
    Session.set('stage.lines', [this.alignmentToLine(this.principal, 'black')]);
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
