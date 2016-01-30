"use strict";

const augmentTreeWithLabels = (node) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.label = `${value} - ${decomposition_util.ids_data[value].label}`;
    node.children.map((child) => augmentTreeWithLabels(child));
  } else {
    node.label = `${value} - another character`;
  }
}

const coerceToUnicode = (character) => {
  if (character.startsWith('&#') && character.endsWith(';')) {
    const char_code = parseInt(character.slice(2, character.length - 1), 10);
    return String.fromCharCode(char_code);
  }
  return character;
}

const constructTree = (decomposition) => {
  const tree = decomposition_util.convertDecompositionToTree(decomposition);
  augmentTreeWithLabels(tree);
  return tree;
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

const DataController = function($scope, $routeParams, $http) {
  this.character = coerceToUnicode($routeParams.character);
  this.decomposition = [];
  this.metadata = [];
  this.strokes = [];

  this._class= () => {
    return window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal';
  }
  this.class = this._class();

  this._refresh = (row) => {
    this.decomposition.push(constructTree(row.decomposition));
    this.metadata = [
      {label: 'Definition:', value: row.definition},
      {label: 'Pinyin:', value: row.pinyin.join(', ')},
      {label: 'Radical:', value: row.radical},
    ];
    this.strokes = row.strokes;
  }
  getCharacterData($http, this.character, this._refresh.bind(this));
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
