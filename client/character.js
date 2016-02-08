const animations = new ReactiveVar();
const character = new ReactiveVar();
const metadata = new ReactiveVar();
const strokes = new ReactiveVar();
const tree = new ReactiveVar();

let animation = null;

const orientation = new ReactiveVar('horizontal');
const short = new ReactiveVar(false);

// Methods used to render all the various pieces of character metadata.

const augmentTreeWithLabels = (node, dependencies) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.label = lower(makemeahanzi.Decomposition.ids_data[value].label);
    node.children.map((child) => augmentTreeWithLabels(child, dependencies));
  } else {
    node.label = dependencies[node.value] || '(unknown)';
  }
}

const constructTree = (row) => {
  const util = makemeahanzi.Decomposition;
  const tree = util.convertDecompositionToTree(row.decomposition);
  augmentTreeWithLabels(tree, row.dependencies);
  return tree;
}

const formatEtymology = (etymology) => {
  const result = [etymology.type];
  if (etymology.type === 'ideographic' ||
      etymology.type === 'pictographic') {
    if (etymology.hint) {
      result.push(`- ${lower(etymology.hint)}`);
    }
  } else {
    result.push('-');
    result.push(etymology.semantic || '?');
    if (etymology.hint) {
      result.push(`(${lower(etymology.hint)})`);
    }
    result.push('provides the meaning while');
    result.push(etymology.phonetic || '?');
    result.push('provides the pronunciation.');
  }
  return result.join(' ');
}

const lower = (string) => {
  if (string.length === 0) return string;
  return string[0].toLowerCase() + string.substr(1);
}

const refreshMetadata = (row) => {
  const options = {delay: 0.3, speed: 0.02};
  animation = new makemeahanzi.Animation(options, row.strokes, row.medians);
  animate(advanceAnimation);
  metadata.set([
    {label: 'Definition:', value: row.definition},
    {label: 'Pinyin:', value: row.pinyin.join(', ')},
    {label: 'Radical:', value: row.radical},
  ]);
  if (row.etymology) {
    metadata.push({
      label: 'Formation:',
      value: formatEtymology(row.etymology),
    });
  }
  strokes.set(row.strokes.map((d) => ({d: d, class: 'incomplete'})));
  tree.set(constructTree(row));
}

const updateCharacter = () => {
  const value = character.get();
  if (value == null) {
    return;
  }
  const part = Math.floor(value.charCodeAt(0) / 256);
  $.get(`characters/part-${part}.txt`, (response, code) => {
    if (code !== 'success') throw new Error(code);
    const data = JSON.parse(response);
    for (let row of data) {
      if (row.character === character.get()) {
        refreshMetadata(row);
      }
    }
  });
}

// Methods for running the stroke-order animation.

const animate = window.requestAnimationFrame ||
                ((callback) => setTimeout(callback, 1000 / 60));

const advanceAnimation = () => {
  if (animation == null) {
    return;
  }
  const step = animation.step();
  const complete = step.animations.length - (step.complete ? 0 : 1);

  if (complete > 0 && strokes.get()[complete - 1].class !== 'complete') {
    const current = strokes.get();
    for (let i = 0; i < complete ; i++) {
      current[i].class = 'complete';
    }
    strokes.set(current);
  }
  animations.set(step.animations.slice(complete));
  if (!step.complete) {
    animate(advanceAnimation);
  }
}

const resize = () => {
  short.set(window.innerWidth <= 480 ? 'short ' : '');
  orientation.set(window.innerWidth < window.innerHeight ?
                  'vertical' : 'horizontal');
}

// Meteor template bindings.

Template.character.helpers({
  character: () => character.get(),
  metadata: () => metadata.get(),
  tree: () => tree.get(),

  orientation: () => orientation.get(),
  short: () => short.get(),

  format: (label) => (short.get() ? label.slice(0, 3) + ':' : label),
  horizontal: () => orientation.get() === 'horizontal',
  vertical: () => orientation.get() === 'vertical',
});

Template.order.helpers({
  animations: () => animations.get(),
  strokes: () => strokes.get(),
});

Meteor.startup(() => {
  Deps.autorun(updateCharacter)
  hashchange();
  resize();
});

const hashchange = () => {
  const hash = window.location.hash;
  [animations, character, metadata, strokes, tree].map((x) => x.set(null));
  animation = null;
  if (Session.get('route') === 'character') {
    const codepoint = parseInt(hash.slice(hash.lastIndexOf('/') + 1), 10);
    character.set(String.fromCharCode(codepoint));
  }
}

window.addEventListener('hashchange', hashchange, false);
