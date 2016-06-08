import {getAnimationData} from '../lib/animation';
import {Decomposition} from '../lib/decomposition';

const character = new ReactiveVar();
const metadata = new ReactiveVar();
const stroke_order = new ReactiveVar();
const transform = new ReactiveVar();
const tree = new ReactiveVar();

const augmentTreeWithLabels = (node, dependencies) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.class = 'ids';
    node.label = lower(Decomposition.ids_data[value].label);
    node.children.map((child) => augmentTreeWithLabels(child, dependencies));
  } else {
    node.label = dependencies[node.value] || '(unknown)';
    if (dependencies[node.value]) {
      node.link = `#/codepoint/${node.value.charCodeAt(0)}`;
    }
  }
}

const constructTree = (row) => {
  const tree = Decomposition.convertDecompositionToTree(row.decomposition);
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

const linkify = (value) => {
  const result = [];
  for (let character of value) {
    if (character.match(/[\u3400-\u9FBF]/)) {
      result.push(`<a href="#/codepoint/${character.charCodeAt(0)}" ` +
                     `class="link">${character}</a>`);
    } else {
      result.push(character);
    }
  }
  return result.join('');
}

const lower = (string) => {
  if (string.length === 0) return string;
  return string[0].toLowerCase() + string.substr(1);
}

const refreshTemplateVariables = (row) => {
  const value = [
    {label: 'Def:', value: row.definition},
    {label: 'Pin:', value: row.pinyin.join(', ')},
    {label: 'Rad:', value: row.radical},
  ];
  if (row.etymology) {
    value.push({
      label: 'For:',
      value: formatEtymology(row.etymology),
    });
  }
  character.set(row.character);
  metadata.set(value);
  stroke_order.set(getAnimationData(row.strokes, row.medians));
  tree.set(constructTree(row));
}

class Answer {
  static hide() {
    transform.set();
  }
  static show(row) {
    refreshTemplateVariables(row);
    transform.set('translateY(0)');
  }
}

Template.answer.helpers({
	linkify: linkify,
  character: () => character.get(),
  metadata: () => metadata.get(),
  stroke_order: () => stroke_order.get(),
  transform: () => transform.get(),
  tree: () => tree.get(),
});

export {Answer};
