"use strict";

const augmentTreeWithLabels = (node, dependencies) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.label = lower(decomposition_util.ids_data[value].label);
    node.children.map((child) => augmentTreeWithLabels(child, dependencies));
  } else {
    node.label = dependencies[node.value] || '(unknown)';
  }
}

const coerceToUnicode = (character) => {
  if (character.startsWith('&#') && character.endsWith(';')) {
    const char_code = parseInt(character.slice(2, character.length - 1), 10);
    return String.fromCharCode(char_code);
  }
  return character;
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

const getCharacterData = ($http, character, callback) => {
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

const lower = (string) => {
  if (string.length === 0) return string;
  return string[0].toLowerCase() + string.substr(1);
}

const DataController = function($scope, $routeParams, $http) {
  this.character = coerceToUnicode($routeParams.character);
  this.decomposition = [];
  this.metadata = [];
  this.strokes = [];

  this._class= () => {
    const short = window.innerWidth <= 480 ? 'short ' : '';
    const orientation = window.innerWidth < window.innerHeight ?
                        'vertical' : 'horizontal';
    return short + orientation;
  }
  this.class = this._class();

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
  }
  getCharacterData($http, this.character, this._refresh.bind(this));
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
