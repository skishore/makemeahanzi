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
    return tree.medians.map((x, i) => ({
      character: tree.value,
      index: i,
      median: x,
      path: tree.path,
    }));
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
  for (let component of components) {
    const transform = getAffineTransform([[0, 0], [1, 1]], component.bounds);
    for (let median of component.medians) {
      const stroke = normalize(median).map(transform);
      stroke.median = median;
      targets.push(stroke);
    }
  }

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

  const matching = new Hungarian(matrix);
  targets.map((y, j) => y.median.match = matching.y_match[j]);
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
  return Math.max(option1, option2);
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
    const nodes = collectComponentNodes(this.tree);
    nodes.map((node) => {
      const glyph = Glyphs.findOne({character: node.value});
      node.medians = glyph.stages.strokes.map(median_util.findStrokeMedian);
    });

    // TODO(skishore): Combine this stroke order with the matching.
    const log = [];
    const result = buildStrokeOrder(this.tree, log);

    this.matching = matchStrokes(this.medians, nodes);
    this.forceRefresh();
  }
  refreshUI() {
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
    for (let i = 0; i < (matching.matching || []).length; i++) {
      const block = matching.matching[i];
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
