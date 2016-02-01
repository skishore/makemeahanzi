"use strict";

angular.module('makemeahanzi', ['ngRoute'])
       .config(($routeProvider, $locationProvider) => {
         $routeProvider.when('/codepoint/:codepoint',
                             {templateUrl: 'character.html'})
                       .otherwise({templateUrl: 'search.html'});
       });
