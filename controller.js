"use strict";

angular.module('makemeahanzi', ['ngRoute'])
       .config(($routeProvider, $locationProvider) => {
         $routeProvider.when('/character/:character',
                             {templateUrl: 'data.html'})
                       .otherwise({templateUrl: 'search.html'});
       });
