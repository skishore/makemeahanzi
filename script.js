"use strict";

const createSketch = ($scope, controller, canvas, svg) => {
  let mousedown = false;
  Sketch.create({
    container: canvas,
    autoclear: false,
    fullscreen: false,
    width: svg.clientWidth,
    height: svg.clientHeight,
    keydown(e) {
      if (this.keys.C) {
        $scope.$apply(() => {
          mousedown = false;
          controller.clear();
        });
      }
    },
    mousedown(e) {
      $scope.$apply(() => {
        mousedown = true;
        controller.push_point([e.x, e.y]);
      });
    },
    mouseup(e) {
      $scope.$apply(() => {
        mousedown = false;
        controller.end_stroke();
      });
    },
    touchmove() {
      if (mousedown && this.touches.length > 0) {
        $scope.$apply(() => {
          const touch = this.touches[0];
          controller.maybe_push_point([touch.ox, touch.oy]);
          controller.push_point([touch.x, touch.y]);
        });
      }
    }
  });
}

const MakeMeAHanziController = function($scope) {
  const container = content.querySelector('#content #container');

  this.strokes = [];
  this.stroke = () => this._d(this._stroke);
  this.candidates = [];

  // TODO(skishore): Replace this link with a link to our own data.
  this.url = 'https://en.wiktionary.org/wiki/';
  this.getURL = (character) => this.url + encodeURIComponent(character);

  this._zoom = () => {
    const wrapper = container.parentElement;
    const x_zoom = content.clientWidth / container.clientWidth;
    const y_zoom = content.clientHeight / container.clientHeight;
    return Math.min(x_zoom, y_zoom);
  }
  this.zoom = this._zoom();

  this._stroke = [];
  this._strokes = [];
  this._matcher = null;

  window.controller = this;

  getMediansPromise().then((medians) => {
    this._matcher = new Matcher(medians);
  }).catch(console.error.bind(console));

  this._d = (path) => {
    if (path.length < 2) return '';
    const result = [];
    const point = (i) => `${path[i][0]} ${path[i][1]}`;
    const midpoint = (i) => `${(path[i][0] + path[i + 1][0])/2} ` +
                            `${(path[i][1] + path[i + 1][1])/2}`;
    const push = (x) => result.push(x);
    ['M', point(0), 'L', midpoint(0)].map(push);
    for (var i = 1; i < path.length - 1; i++) {
      ['Q', point(i), midpoint(i)].map(push);
    }
    ['L', point(path.length - 1)].map(push);
    return result.join(' ');
  }
  this._refresh_candidates = () => {
    if (this._strokes.length > 0 && this._matcher) {
      this.candidates = this._matcher.match(this._strokes, 8);
    } else {
      this.candidates = [];
    }
  }

  this.clear = () => {
    this.strokes = [];
    this._stroke = [];
    this._strokes = [];
    this._refresh_candidates();
    this.candidates = [];
  }
  this.end_stroke = () => {
    if (this._stroke.length > 1) {
      this.strokes.push(this._d(this._stroke));
      this._strokes.push(this._stroke);
      this._stroke = [];
      this._refresh_candidates();
    }
  }
  this.maybe_push_point = (point) => {
    if (this._stroke.length === 0) {
      this.push_point(point);
    }
  }
  this.push_point = (point) => {
    if (point[0] != null && point[1] != null) {
      this._stroke.push(point.map((x) => x / this.zoom));
    }
  }
  this.undo = () => {
    this.strokes.pop();
    this._strokes.pop();
    this._stroke = [];
    this._refresh_candidates();
  }

  const canvas = container.querySelector('.handwriting .input');
  const svg = content.querySelector('.handwriting svg');
  createSketch($scope, this, canvas, svg);
}

angular.module('makemeahanzi', [])
       .controller('MakeMeAHanziController', MakeMeAHanziController);
