"use strict";

const coerceToUnicode = (character) => {
  if (character.startsWith('&#') && character.endsWith(';')) {
    const char_code = parseInt(character.slice(2, character.length - 1), 10);
    return String.fromCharCode(char_code);
  }
  return character;
}

const DataController = function($scope, $routeParams, $http) {
  this.character = coerceToUnicode($routeParams.character);
  this.metadata = [];
  this.strokes = [];

  this._class= () => {
    return window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal';
  }
  this.class = this._class();

  this._refresh = (row) => {
    this.metadata = [
      {label: 'Definition:', value: row.definition},
      {label: 'Pinyin:', value: row.pinyin.join(', ')},
      {label: 'Radical:', value: row.radical},
    ];
    this.strokes = row.strokes;
  }

  const part = Math.floor(this.character.charCodeAt(0) / 256);
  $http.get(`data/part-${part}.txt`).then((response) => {
    const data = response.data;
    for (let row of response.data) {
      if (row.character === this.character) {
        this._refresh(row);
        break;
      }
    }
  });
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
