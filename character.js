"use strict";

const coerceToUnicode = (character) => {
  if (character.startsWith('&#') && character.endsWith(';')) {
    const char_code = parseInt(character.slice(2, character.length - 1), 10);
    return String.fromCharCode(char_code);
  }
  return character;
}

const DataController = function($scope, $routeParams) {
  this.character = coerceToUnicode($routeParams.character);
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
