"use strict";

// Prints the message and throws an error if the conditionis false.
this.assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}

// Returns a list of the unique values in the given array, ordered by their
// first appearance in the array.
Array.prototype.unique = function() {
  const result = [];
  const seen = {};
  this.map((x) => {
    if (!seen[x]) {
      result.push(x);
      seen[x] = true;
    }
  });
  return result;
}

// Given a string and a dict mapping characters to other characters, return a
// string with that mapping applied to each of its characters.
String.prototype.applyMapping = function(mapping) {
  let result = '';
  for (let i = 0; i < this.length; i++) {
    result += mapping[this[i]] ? mapping[this[i]] : this[i];
  }
  return result;
}

// Helper methods for use with angles, which are floats in [-pi, pi).
assert(this.Angle === undefined, 'Redefining Angle global!');
this.Angle = {
  subtract: (angle1, angle2) => {
    var result = angle1 - angle2;
    if (result < -Math.PI) {
      result += 2*Math.PI;
    }
    if (result >= Math.PI) {
      result -= 2*Math.PI;
    }
    return result;
  },
  penalty: (diff) => diff*diff,
};

const isNumber = (x) => Number.isFinite(x) && !Number.isNaN(x);

// Helper methods for use with "points", which are pairs of integers.
assert(this.Point === undefined, 'Redefining Point global!');
this.Point = {
  add: (point1, point2) => [point1[0] + point2[0], point1[1] + point2[1]],
  angle: (point) => Math.atan2(point[1], point[0]),
  clone: (point) => [point[0], point[1]],
  distance2(point1, point2) {
    var diff = Point.subtract(point1, point2);
    return Math.pow(diff[0], 2) + Math.pow(diff[1], 2);
  },
  dot: (point1, point2) => point1[0]*point2[0] + point1[1]*point2[1],
  equal: (point1, point2) => point1[0] === point2[0] && point1[1] === point2[1],
  key: (point) => point.join(','),
  midpoint: (point1, point2) => {
    return [(point1[0] + point2[0])/2, (point1[1] + point2[1])/2];
  },
  subtract: (point1, point2) => [point1[0] - point2[0], point1[1] - point2[1]],
  valid: (point) => isNumber(point[0]) && isNumber(point[1]),
};
