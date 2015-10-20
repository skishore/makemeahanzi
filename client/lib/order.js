"use strict";

let stage = undefined;
let voronoi = undefined;

const size = 1024;

const filterMedian = (median, n) => {
  const distances = _.range(median.length - 1).map(
      (i) => Math.sqrt(Point.distance2(median[i], median[i + 1])));
  let total = 0;
  distances.map((x) => total += x);
  const result = [];
  let index = 0;
  let position = median[0];
  let total_so_far = 0;
  for (let i of _.range(n - 1)) {
    const target = i*total/(n - 1);
    while (total_so_far < target) {
      const step = Math.sqrt(Point.distance2(position, median[index + 1]));
      if (total_so_far + step < target) {
        index += 1;
        position = median[index];
        total_so_far += step;
      } else {
        const t = (target - total_so_far)/step;
        position = [(1 - t)*position[0] + t*median[index + 1][0],
                    (1 - t)*position[1] + t*median[index + 1][1]];
        total_so_far = target;
      }
    }
    result.push(Point.clone(position));
  }
  result.push(median[median.length - 1]);
  return result;
}

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
  const bounding_box = {xl: -size, xr: size, yt: -size, yb: size};
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

// TODO(skishore): Consider using sqrt(1/2) in place of 1/2 here. This constant
// is used to compute bounds for components that are surrounded.
const rad2 = 1/2;
const compound_bounds = {
  '⿰': [[[0, 0], [1/2, 1]], [[1/2, 0], [1/2, 1]]],
  '⿱': [[[0, 0], [1, 1/2]], [[0, 1/2], [1, 1/2]]],
  '⿴': [[[0, 0], [1, 1]], [[(1 - rad2)/2, (1 - rad2)/2], [rad2, rad2]]],
  '⿵': [[[0, 0], [1, 1]], [[(1 - rad2)/2, 1 - rad2], [rad2, rad2]]],
  '⿶': [[[0, 0], [1, 1]], [[(1 - rad2)/2, 0], [rad2, rad2]]],
  '⿷': [[[0, 0], [1, 1]], [[1 - rad2, (1 - rad2)/2], [rad2, rad2]]],
  '⿸': [[[0, 0], [1, 1]], [[1 - rad2, 1 - rad2], [rad2, rad2]]],
  '⿹': [[[0, 0], [1, 1]], [[0, 1 - rad2], [rad2, rad2]]],
  '⿺': [[[0, 0], [1, 1]], [[1 - rad2, 0], [rad2, rad2]]],
  '⿻': [[[0, 0], [1, 1]], [[0, 0], [1, 1]]],
  '⿳': [[[0, 0], [1, 1/3]], [[0, 1/3], [1, 1/3]], [[0, 2/3], [1, 1/3]]],
  '⿲': [[[0, 0], [1/3, 1]], [[1/3, 0], [1/3, 1]], [[2/3, 0], [1/3, 1]]],
}

const augmentTreeWithBoundsData = (tree, bounds) => {
  tree.bounds = bounds;
  if (tree.type === 'compound') {
    const diff = Point.subtract(bounds[1], bounds[0]);
    const targets = compound_bounds[tree.value];
    assert(targets && targets.length === tree.children.length);
    for (let i = 0; i < targets.length; i++) {
      const target = [targets[i][0], Point.add(targets[i][0], targets[i][1])];
      const child_bounds = target.map(
          (x) => [x[0]*diff[0] + bounds[0][0], x[1]*diff[1] + bounds[0][1]].map(
              Math.floor));
      augmentTreeWithBoundsData(tree.children[i], child_bounds);
    }
  } else {
    assert(!tree.children);
  }
  return tree;
}

const collectComponentNodes = (tree, result) => {
  result = result || [];
  if (tree.type === 'character' && tree.value !== '?') {
    result.push(tree);
  }
  for (let child of tree.children || []) {
    collectComponentNodes(child, result);
  }
  return result;
}

const getAffineTransform = (source, target) => {
  const sdiff = Point.subtract(source[1], source[0]);
  const tdiff = Point.subtract(target[1], target[0]);
  const ratio = [tdiff[0]/sdiff[0], tdiff[1]/sdiff[1]];
  return (point) => [ratio[0]*(point[0] - source[0][0]) + target[0][0],
                     ratio[1]*(point[1] - source[0][1]) + target[0][1]];
}

const getSegmentBounds = (segment, tolerance) => {
  const result = [[Math.min(segment[0][0][0], segment[1][0][0]),
                   Math.min(segment[0][0][1], segment[1][0][1])],
                  [Math.max(segment[0][0][0], segment[1][0][0]),
                   Math.max(segment[0][0][1], segment[1][0][1])]];
  tolerance = tolerance || 8;
  _.range(2).filter((i) => result[1][i] < result[0][i] + tolerance)
            .map((i) => result[1][i] = result[0][i] + tolerance);
  return result;
}

const matchStrokes = (character, components) => {
  character = character.map(normalizeMedian);
  components.map((x) => x.medians = x.medians.map(normalizeMedian));

  const strokes = [];
  const source = [[0, 0], [size, size]];
  for (let component of components) {
    const transform = getAffineTransform(source, component.bounds);
    for (let median of component.medians) {
      const stroke = median.map(transform);
      stroke.median = median;
      strokes.push(stroke);
    }
  }

  const matrix = [];
  const n = Math.max(strokes.length, character.length);
  for (let i = 0; i < n; i++) {
    matrix.push([]);
    for (let j = 0; j < n; j++) {
      if (i < strokes.length && j < character.length) {
        matrix[i].push(scoreStrokes(strokes[i], character[j]));
      } else {
        matrix[i].push(i < strokes.length ? -size*size*size : 0);
      }
    }
  }
  const matching = new Hungarian(matrix);
  strokes.map((x, i) => x.median.match = matching.x_match[i]);
  return components.map((x) => {
    return {value: x.value, matching: x.medians.map((y) => y.match)};
  });
}

const normalizeMedian = (median) => {
  return filterMedian(median, 8).map((x) => [x[0], 900 - x[1]]);
}

const scoreStrokes = (stroke1, stroke2) => {
  assert(stroke1.length === stroke2.length);
  let option1 = 0;
  let option2 = 0;
  _.range(stroke1.length).map((i) => {
    option1 -= Point.distance2(stroke1[i], stroke2[i]);
    option2 -= Point.distance2(stroke1[i], stroke2[stroke2.length - i - 1]);
  });
  return Math.floor(Math.max(option1, option2));
}

stages.order = class OrderStage extends stages.AbstractStage {
  constructor(glyph) {
    super('order');
    this.character = glyph.character;
    this.strokes = glyph.stages.strokes;
    this.medians = this.strokes.map(findStrokeMedian);
    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    this.tree = augmentTreeWithBoundsData(tree, [[0, 0], [size, size]]);
    Session.set('stages.order.components',
                decomposition_util.collectComponents(this.tree));
    stage = this;
  }
  onAllComponentsReady() {
    const nodes = collectComponentNodes(this.tree);
    nodes.map((node) => {
      const glyph = Glyphs.findOne({character: node.value});
      node.medians = glyph.stages.strokes.map(findStrokeMedian);
    });
    const matching = matchStrokes(this.medians, nodes);
    Session.set('stages.order.matching', {
      character: this.character,
      colors: this.colors,
      matching: matching,
    });
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
    this.medians.map((x) => filterMedian(x, 8))
                .map((x, i) => x.map((y) => points.push(to_point(y, i))));
    Session.set('stage.points', points);
  }
}

Template.order_stage.helpers({
  matching: () => {
    const matching = Session.get('stages.order.matching') || {};
    const character = Session.get('editor.glyph');
    const result = [];
    for (let block of matching.matching || []) {
      const matched = {};
      const match = [[], []];
      const component = Glyphs.findOne({character: block.value});
      for (let i = 0; i < component.stages.strokes.length; i++) {
        const color = matching.colors[i % matching.colors.length];
        match[0].push({
          d: component.stages.strokes[i],
          fill: color,
          stroke: 'black',
        });
        const j = block.matching[i];
        if (j < character.stages.strokes.length) {
          match[1].push({
            d: character.stages.strokes[j],
            fill: color,
            stroke: 'black',
          });
          matched[j] = true;
        }
      }
      for (let i = 0; i < character.stages.strokes.length; i++) {
        if (!matched[i]) {
          match[1].push({
            d: character.stages.strokes[i],
            fill: 'lightgray',
            stroke: 'lightgray',
          });
        }
      }
      result.push(match);
    }
    return result;
  },
});

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
