"use strict";

const createSketch = ($scope, controller, element) => {
  let mousedown = false;
  Sketch.create({
    container: element,
    autoclear: false,
    mousedown() {
      $scope.$apply(() => {
        mousedown = true;
      });
    },
    mouseup() {
      $scope.$apply(() => {
        mousedown = false;
        controller.end_stroke();
      });
    },
    touchmove() {
      if (mousedown && this.touches.length > 0) {
        $scope.$apply(() => {
          const touch = this.touches[0];
          controller.push_point([touch.x, touch.y]);
        });
      }
    }
  });
}

const MakeMeAHanziController = function($scope) {
  this.width = () => window.innerWidth;
  this.height = () => window.innerHeight;
  this.strokes = [];
  this.stroke = () => this._d(this._stroke);

  this._stroke = [];

  this._d = (path) => {
    const result = [];
    path.map((entry, i) => {
      result.push(i === 0 ? 'M' : 'L');
      result.push(entry[0]);
      result.push(entry[1]);
    });
    return result.join(' ');
  };

  this.end_stroke = () => {
    if (this._stroke.length > 0) {
      this.strokes.push(this._d(this._stroke));
      this._stroke = [];
    }
  }
  this.push_point = (point) => {
    this._stroke.push(point);
  }

  createSketch($scope, this, document.getElementById('input'));
}

angular.module('makemeahanzi', [])
       .controller('MakeMeAHanziController', MakeMeAHanziController);
