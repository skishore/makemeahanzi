"use strict";

const DataController = function($scope, $routeParams) {
  this.character = $routeParams.character;
}

angular.module('makemeahanzi')
       .controller('DataController', DataController);
