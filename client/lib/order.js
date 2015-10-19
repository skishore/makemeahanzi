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

const getAlignmentBounds = (alignment, tolerance) => {
  const result = [[Math.min(alignment[0][0][0], alignment[1][0][0]),
                   Math.min(alignment[0][0][1], alignment[1][0][1])],
                  [Math.max(alignment[0][0][0], alignment[1][0][0]),
                   Math.max(alignment[0][0][1], alignment[1][0][1])]];
  tolerance = tolerance || 8;
  _.range(2).filter((i) => result[1][i] < result[0][i] + tolerance)
            .map((i) => result[1][i] = result[0][i] + tolerance);
  return result;
}

const getAffineTransform = (source, target) => {
  const sdiff = Point.subtract(source[1], source[0]);
  const tdiff = Point.subtract(target[1], target[0]);
  const ratio = [tdiff[0]/sdiff[0], tdiff[1]/sdiff[1]];
  return (point) => [ratio[0]*(point[0] - source[0][0]) + target[0][0],
                     ratio[1]*(point[1] - source[0][1]) + target[0][1]];
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

const matchStrokes = (character, component) => {
  const n = Math.max(character.length, component.length);
  const matrix = [];
  for (let i = 0; i < n; i++) {
    matrix.push([]);
    for (let j = 0; j < n; j++) {
      if (i < component.length && j < character.length) {
        matrix[i].push(scoreStrokes(component[i], character[j]));
      } else {
        matrix[i].push(i < component.length ? -size*size*size : 0);
      }
    }
  }
  let score = 0;
  const matching = new Hungarian(matrix);
  matching.x_match.map((j, i) => score += matrix[i][j]);
  return {matching: matching.x_match, score: score};
}

const scoreAlignment = (character, component, alignment) => {
  const principal = getPrincipalLine(getMedianEndpoints(component));
  const source = getAlignmentBounds(alignment);
  const target = getAlignmentBounds(principal);

  // Compute a map from points in the character to points in the component
  // and use it to compute a mapping between component and character strokes.
  const transform = getAffineTransform(source, target);
  const transformed = character.map((x) => x.map(transform));
  const matching = matchStrokes(transformed, component);

  // Compute a map from points in the component to points in the character
  // and use it to see where the component's glyph bounds would be mapped to.
  const inverse = getAffineTransform(target, source);
  const border = [inverse([0, 0]), inverse([size, size])];

  return matching;
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

    // Compute a list of 'filtered medians' that represent the character and
    // its component. All the filtered medians will have exactly 8 points.
    const medians = glyph.stages.strokes.map(findStrokeMedian);
    const character = this.medians.map((x) => filterMedian(x, 8));
    const component = medians.map((x) => filterMedian(x, 8));

    const alignments = getPossibleAlignments(character, component);
    let best_alignment = undefined;
    let best_result = {score: -Infinity};
    alignments.map((x) => {
      const result = scoreAlignment(character, component, x);
      if (result.score > best_result.score) {
        [best_alignment, best_result] = [x, result];
      }
    });
    Session.set('stages.order.matching', {
      character: this.character,
      component: components[0],
      matching: best_result.matching,
      colors: this.colors,
    });

    Meteor.setTimeout(() => {
      //const lines = Session.get('stage.lines');
      //const display = alignments.map((x) => this.alignmentToLine(x, 'red'));
      //Session.set('stage.lines', display.concat([lines[0]]));
      Session.set('stage.lines', [Session.get('stage.lines')[0],
                                  this.alignmentToLine(best_alignment, 'red')]);
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
    this.medians.map((x) => filterMedian(x, 8))
                .map((x, i) => x.map((y) => points.push(to_point(y, i))));
    Session.set('stage.points', points);
    Session.set('stage.lines', [this.alignmentToLine(this.principal, 'black')]);
  }
}

Template.order_stage.helpers({
  matching: () => {
    const matching = Session.get('stages.order.matching') || {};
    const character = Session.get('editor.glyph');
    const component = Glyphs.findOne({character: matching.component});
    if (!matching || !character || !component) {
      return;
    }
    const matched = {};
    const match = [[], []];
    for (let i = 0; i < component.stages.strokes.length; i++) {
      const color = matching.colors[i % matching.colors.length];
      match[0].push({
        d: component.stages.strokes[i],
        fill: color,
        stroke: 'black',
      });
      const j = matching.matching[i];
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
    return [match];
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
