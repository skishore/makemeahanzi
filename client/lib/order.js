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
          (x) => [x[0]*diff[0] + bounds[0][0], x[1]*diff[1] + bounds[0][1]]);
      augmentTreeWithBoundsData(tree.children[i], child_bounds);
    }
  } else {
    assert(!tree.children);
  }
  return tree;
}

const buildStrokeOrder = (tree, log) => {
  if (tree.type === 'character') {
    if (!tree.medians) {
      log.push(`Missing component: ${tree.value}`);
      return [];
    }
    return tree.medians.map((x) => ({median: x, node: tree}));
  }
  const parts = tree.children.map((x) => buildStrokeOrder(x, log));
  const child = tree.children[0].value;
  if (tree.value === '⿻') {
    log.push('Cannot infer stroke order for compound ⿻.');
  } else if (tree.value === '⿴') {
    assert(parts.length === 2);
    if (parts[0].length !== 3) {
      log.push('Compound ⿴ requires first component 囗. ' +
               `Got ${child} instead.`);
    } else {
      return parts[0].slice(0, 2).concat(parts[1]).concat([parts[0][2]]);
    }
  } else if (tree.value === '⿷') {
    assert(parts.length === 2);
    if (parts[0].length !== 2) {
      log.push('Compound ⿷ requires first component ⼕ or ⼖. ' +
               `Got ${child} instead.`);
    } else {
      return parts[0].slice(0, 1).concat(parts[1]).concat([parts[0][1]]);
    }
  } else if (tree.value === '⿶' ||
             (tree.value === '⿺' && '辶廴乙'.indexOf(child) >= 0)) {
    assert(parts.length === 2);
    return parts[1].concat(parts[0]);
  }
  const result = [];
  parts.map((x) => x.map((y) => result.push(y)));
  return result;
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
  const normalize = median_util.normalizeForMatch;
  const sources = character.map(normalize);
  const targets = [];
  components.map((x) => {
    const transform = getAffineTransform([[0, 0], [1, 1]], x.node.bounds);
    const target = normalize(x.median).map(transform);
    targets.push(target);
  });

  const matrix = [];
  const missing_penalty = 1024;
  const n = Math.max(sources.length, targets.length);
  for (let i = 0; i < n; i++) {
    matrix.push([]);
    for (let j = 0; j < n; j++) {
      if (i < sources.length && j < targets.length) {
        matrix[i].push(scoreStrokes(sources[i], targets[j]));
      } else {
        matrix[i].push(-missing_penalty);
      }
    }
  }
  return new Hungarian(matrix).x_match;
}

const scoreStrokes = (stroke1, stroke2) => {
  assert(stroke1.length === stroke2.length);
  let option1 = 0;
  let option2 = 0;
  _.range(stroke1.length).map((i) => {
    option1 -= Point.distance2(stroke1[i], stroke2[i]);
    option2 -= Point.distance2(stroke1[i], stroke2[stroke2.length - i - 1]);
  });
  return Math.max(option1, option2);
}

stages.order = class OrderStage extends stages.AbstractStage {
  constructor(glyph) {
    super('order');
    this.matching = undefined;
    this.medians = glyph.stages.strokes.map(median_util.findStrokeMedian);
    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    this.tree = augmentTreeWithBoundsData(tree, [[0, 0], [1, 1]]);
    stage = this;
  }
  onAllComponentsReady() {
    const nodes = collectComponentNodes(this.tree);
    nodes.map((node) => {
      const glyph = Glyphs.findOne({character: node.value});
      node.medians = glyph.stages.strokes.map(median_util.findStrokeMedian);
    });
    const log = [];
    const order = buildStrokeOrder(this.tree, log);
    const matching = matchStrokes(this.medians, order);
    const indices = _.range(this.medians.length).sort(
        (a, b) => matching[a] - matching[b]);
    this.order = indices.map((x) => {
      const match = order[matching[x]];
      return {
        match: match ? match.node.path : undefined,
        median: this.medians[x],
        stroke: x,
      };
    });
    this.forceRefresh();
  }
  refreshUI() {
    Session.set('stage.status', [{
      cls: this.matching ? 'success' : 'error',
      message: this.order ?
          'Stroke order determined by decomposition.' :
          'Loading component data...',
    }]);
    Session.set('stages.order.components',
                decomposition_util.collectComponents(this.tree));
    Session.set('stages.order.matching', {
      colors: this.colors,
      order: this.order,
      tree: this.tree,
    });
  }
}

Template.order_stage.helpers({
  matching: () => {
    const matching = Session.get('stages.order.matching') || {};
    const character = Session.get('editor.glyph');
    const indices = {};
    const result = [];
    for (let i = 0; i < (matching.order || []).length; i++) {
      const match = [[], []];
      const order = matching.order[i];

      const key = JSON.stringify(order.match);
      const index = indices.hasOwnProperty(key) ?
          indices[key] : Object.keys(indices).length;
      indices[key] = index;
      const color = matching.colors[index % matching.colors.length];

      if (order.match) {
        const subtree = decomposition_util.getSubtree(
            matching.tree, order.match);
        const component = Glyphs.findOne({character: subtree.value});
        for (let stroke of component.stages.strokes) {
          match[0].push({d: stroke, fill: color, stroke: 'black'});
        }
      }
      for (let j = 0; j < character.stages.strokes.length; j++) {
        match[1].push({
          d: character.stages.strokes[j],
          fill: order.stroke === j ? color : 'lightgray',
          stroke: order.stroke === j ? 'black' : 'lightgray',
        });
      }
      match.top = `${198*i + 8}px`;
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
