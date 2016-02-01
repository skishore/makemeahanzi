"use strict";

const animate = window.requestAnimationFrame ||
                ((callback) => setTimeout(callback, 1000 / 60));

const augmentTreeWithLabels = (node, dependencies) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.label = lower(decomposition_util.ids_data[value].label);
    node.children.map((child) => augmentTreeWithLabels(child, dependencies));
  } else {
    node.label = dependencies[node.value] || '(unknown)';
  }
}

const constructTree = (row) => {
  const decomposition = row.decomposition;
  const tree = decomposition_util.convertDecompositionToTree(decomposition);
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

const DataController = function($scope, $routeParams, $http) {
  this.character = String.fromCharCode(parseInt($routeParams.codepoint, 10));
  this.animations = [];
  this.decomposition = [];
  this.metadata = [];
  this.strokes = [];
  this._animation = null;

  this._advanceAnimation = () => {
    if (!this._animation) {
      return;
    }
    const step = this._animation.step();
    $scope.$apply(() => this.animations = step.animations);
    if (!step.complete) {
      animate(this._advanceAnimation);
    }
  }

  this._getCharacterData  = (character, callback) => {
    const part = Math.floor(character.charCodeAt(0) / 256);
    $http.get(`data/part-${part}.txt`).then((response) => {
      const data = response.data;
      for (let row of response.data) {
        if (row.character === character) {
          return callback(row);
        }
      }
    });
  }

  this._refresh = (row) => {
    const short = window.innerWidth <= 480;
    this.decomposition.push(constructTree(row));
    this.metadata = [
      {label: (short ? 'Def.' : 'Definition:'), value: row.definition},
      {label: (short ? 'Pin.' : 'Pinyin:'), value: row.pinyin.join(', ')},
      {label: (short ? 'Rad.' : 'Radical:'), value: row.radical},
    ];
    if (row.etymology) {
      this.metadata.push({
        label: (short ? 'For.' : 'Formation:'),
        value: formatEtymology(row.etymology),
      });
    }
    this.strokes = row.strokes;

    const options = {delay: 0.3, speed: 0.02};
    this._animation = new Animation(options, row.strokes, row.medians);
    animate(this._advanceAnimation);
  }

  this._resize = () => {
    this.short = window.innerWidth <= 480 ? 'short ' : '';
    this.orientation = window.innerWidth < window.innerHeight ?
                       'vertical' : 'horizontal';
  }

  this._getCharacterData(this.character, this._refresh);
  this._resize();

  $scope.$on('$destroy', (event) => {
    this._animation = null;
  });
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
