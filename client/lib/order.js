import {AbstractStage} from '/client/lib/abstract';
import {assert, Point} from '/lib/base';
import {decomposition_util} from '/lib/decomposition_util';
import {Glyphs} from '/lib/glyphs';
import {Hungarian} from '/lib/hungarian';
import {median_util} from '/lib/median_util';

let stage = undefined;

const Order = new Mongo.Collection('order')._collection;

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
        let top_left_penalty = 0;
        if (j >= targets.length) {
          // We want strokes that are not matched with components to be sorted
          // by their proximity to the top-left corner of the glyph. We compute
          // a penalty which is smaller for strokes closer to this corner,
          // then multiply the penalty by j so that those strokes come first.
          const direction = [0.01, 0.02];
          top_left_penalty = -j*Math.min(
              Point.dot(direction, sources[i][0]),
              Point.dot(direction, sources[i][sources[i].length - 1]));
        }
        matrix[i].push(-missing_penalty - top_left_penalty);
      }
    }
  }
  return new Hungarian(matrix).x_match;
}

const maybeReverse = (median, match) => {
  const diff1 = Point.subtract(median[median.length - 1], median[0]);
  let diff2 = [1, -2]
  if (match) {
    const target = match.median;
    diff2 = Point.subtract(target[target.length - 1], target[0]);
  }
  if (Point.dot(diff1, diff2) < 0) {
    median.reverse();
  }
  return median;
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

class OrderStage extends AbstractStage {
  constructor(glyph) {
    super('order');
    this.adjusted = glyph.stages.order;
    this.medians = glyph.stages.strokes.raw.map(median_util.findStrokeMedian);
    this.strokes = glyph.stages.strokes.corrected;

    const tree = decomposition_util.convertDecompositionToTree(
        glyph.stages.analysis.decomposition);
    this.tree = augmentTreeWithBoundsData(tree, [[0, 0], [1, 1]]);

    this.indices = {null: -1};
    this.components = [];
    this.paths = [];
    collectComponentNodes(this.tree).map((x, i) => {
      this.indices[JSON.stringify(x.path)] = i;
      this.components.push(x.value);
      this.paths.push(x.path);
    });

    stage = this;
  }
  handleEvent(event, template) {
    const element = this.adjusted.filter(
        (x) => x.stroke === template.stroke_index)[0];
    const old_index = this.indices[JSON.stringify(element.match || null)];
    const new_index = ((old_index + 2) % (this.components.length + 1)) - 1;
    element.match = this.paths[new_index];
  }
  onAllComponentsReady() {
    if (this.adjusted) {
      return;
    }
    const nodes = collectComponentNodes(this.tree);
    nodes.map((node) => {
      const glyph = Glyphs.findOne({character: node.value});
      node.medians = glyph.stages.order.map((x) => x.median);
    });
    const log = [];
    const order = buildStrokeOrder(this.tree, log);
    const matching = matchStrokes(this.medians, order);
    const indices = _.range(this.medians.length).sort(
        (a, b) => matching[a] - matching[b]);
    this.adjusted = indices.map((x) => {
      const match = order[matching[x]];
      return {
        match: match ? match.node.path : undefined,
        median: maybeReverse(this.medians[x], match),
        stroke: x,
      };
    });
    this.forceRefresh(true /* from_construct_stage */);
  }
  onReverseStroke(stroke) {
    const element = this.adjusted.filter((x) => x.stroke === stroke)[0];
    element.median.reverse();
    this.forceRefresh();
  }
  onSort(old_index, new_index) {
    const elements = this.adjusted.splice(old_index, 1);
    assert(elements.length === 1);
    this.adjusted.splice(new_index, 0, elements[0]);
    this.forceRefresh();
  }
  refreshUI() {
    Session.set('stage.status', this.adjusted ? [] : [{
      cls: 'error',
      message: 'Loading component data...',
    }]);
    Session.set('stages.order.colors', this.colors);
    Session.set('stages.order.components', this.components);
    Session.set('stages.order.indices', this.indices);
    Session.set('stages.order.order', this.adjusted);
    Order.remove({});
    (this.adjusted || []).map((x, i) => {
      const key = JSON.stringify(x.match || null);
      const color = this.colors[this.indices[key]] || 'lightgray';
      const glyph = {
        lines: [{
          x1: x.median[0][0],
          y1: x.median[0][1],
          x2: x.median[x.median.length - 1][0],
          y2: x.median[x.median.length - 1][1],
        }],
        paths: [{d: this.strokes[x.stroke]}],
      };
      const lighten = (color, alpha) => {
        const c = parseInt(color.substr(1), 16);
        return `rgba(${c >> 16}, ${(c >> 8) & 0xFF}, ${c & 0xFF}, ${alpha})`;
      };
      Order.insert({
        background: lighten(color, 0.1),
        color: color,
        glyph: glyph,
        index: i,
        stroke_index: x.stroke,
      });
    });
  }
}

Template.order_stage.events({
  'click .permutation .entry .reverse': function(event) {
    stage && stage.onReverseStroke(this.stroke_index);
  },
});

Template.order_stage.helpers({
  character: () => {
    const colors = Session.get('stages.order.colors');
    const indices = Session.get('stages.order.indices');
    const order = Session.get('stages.order.order');
    const character = Session.get('editor.glyph');
    const result = {paths: []};
    if (!colors || !indices || !order || !character) {
      return result;
    }
    for (let element of order) {
      const index = indices[JSON.stringify(element.match || null)];
      const color = colors[index % colors.length];
      result.paths.push({
        cls: 'selectable',
        d: character.stages.strokes.corrected[element.stroke],
        fill: index < 0 ? 'lightgray' : color,
        stroke: index < 0 ? 'lightgray' : 'black',
        stroke_index: element.stroke,
      });
    }
    return result;
  },
  components: () => {
    const colors = Session.get('stages.order.colors');
    const components = Session.get('stages.order.components');
    const result = [];
    if (!colors || !components) {
      return result;
    }
    for (let index = 0; index < components.length; index++) {
      const color = colors[index % colors.length];
      const glyph = Glyphs.findOne({character: components[index]});
      if (!glyph) {
        continue;
      }
      const component = [];
      for (let stroke of glyph.stages.strokes.corrected) {
        component.push({d: stroke, fill: color, stroke: 'black'});
      }
      result.push({glyph: {paths: component}, top: `${138*index + 8}px`});
    }
    return result;
  },
  items: () => {
    const order = Session.get('stages.order.order');
    return Order.find({}, {limit: (order || []).length});
  },
  options: () => {
    return {
      onSort: (event) => {
        // Suppress the two errors that will be printed when the Sortable
        // plugin tries to persist the sort result to the server.
        Meteor._suppress_log(2);
        stage && stage.onSort(event.oldIndex, event.newIndex);
      },
    }
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

export {OrderStage};
