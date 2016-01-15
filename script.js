"use strict";

const createSketch = (controller, element) => {
	let mousedown = false;
	Sketch.create({
		container: element,
		autoclear: false,
		mousedown() {
      mousedown = true;
    },
		mouseup() {
      mousedown = false;
      controller._end_stroke();
    },
    touchmove() {
      if (mousedown) controller._push_point(touch.x, touch.y);
		}
	});
}

const MakeMeAHanziController = () => {
  this.width = () => window.innerWidth;
  this.height = () => window.innerHeight;
  this.strokes = [];
  this.stroke = [];

  this.d = (path) => {
    const result = [];
    path.map((entry, i) => {
      result.push(i === 0 ? 'M' : 'L');
      result.push(entry[0]);
      result.push(entry[1]);
    });
    return result.join(' ');
  };

  this._push_point = (point) => {
    this.stroke.push(point);
  }
  this._end_stroke = () => {
    if (this.stroke.length > 0) {
      this.strokes.push(this.d(this.stroke));
      this.stroke.length = 0;
    }
  }
  return this;
}

window.onload = () => {
  angular.module('makemeahanzi', [])
         .controller('MakeMeAHanziController', MakeMeAHanziController);
}
