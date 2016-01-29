"use strict";

angular.module('makemeahanzi', ['ngRoute'])
       .config(($routeProvider, $locationProvider) => {
         $routeProvider.when('/character/:character',
                             {templateUrl: 'character.html'})
                       .otherwise({templateUrl: 'search.html'});
       });
