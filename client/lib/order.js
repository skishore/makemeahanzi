"use strict";

let stage = undefined;

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
  '⿸': [[[0, 0], [1, 1 - rad2]], [[1 - rad2, 1 - rad2], [rad2, rad2]]],
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

const matchStrokes = (character, components) => {
  const source = [[0, 0], [1, 1]];
  const strokes = [];
  for (let component of components) {
    const transform = getAffineTransform(source, component.bounds);
    for (let median of component.medians) {
      const stroke = median.map(transform);
      stroke.median = median;
      strokes.push(stroke);
    }
  }

  const matrix = [];
  const missing_penalty = 1024;
  const n = Math.max(strokes.length, character.length);
  for (let i = 0; i < n; i++) {
    matrix.push([]);
    for (let j = 0; j < n; j++) {
      if (i < strokes.length && j < character.length) {
        matrix[i].push(scoreStrokes(strokes[i], character[j]));
      } else {
        matrix[i].push(i < strokes.length ? -missing_penalty : 0);
      }
    }
  }

  const matching = new Hungarian(matrix);
  strokes.map((x, i) => x.median.match = matching.x_match[i]);
  return components.map((x) => {
    return {value: x.value, matching: x.medians.map((y) => y.match)};
  });
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
    this.matching = undefined;
    this.medians = glyph.stages.strokes.map(median_util.findStrokeMedian);
    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    this.strokes = glyph.stages.strokes;
    this.tree = augmentTreeWithBoundsData(tree, [[0, 0], [1, 1]]);
    stage = this;
  }
  onAllComponentsReady() {
    const medians = this.medians.map(median_util.normalizeForMatch);
    const nodes = collectComponentNodes(this.tree);
    nodes.map((node) => {
      const glyph = Glyphs.findOne({character: node.value});
      node.medians = glyph.stages.strokes.map(median_util.findStrokeMedian)
                                         .map(median_util.normalizeForMatch);
    });
    this.matching = matchStrokes(medians, nodes);
    this.forceRefresh();
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
    Session.set('stage.status', [{
      cls: this.matching ? 'success' : 'error',
      message: this.matching ?
          'Stroke order determined by decomposition.' :
          'Loading component data...',
    }]);
    Session.set('stages.order.components',
                decomposition_util.collectComponents(this.tree));
    Session.set('stages.order.matching', {
      character: this.character,
      colors: this.colors,
      matching: this.matching,
    });
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
