"use strict";

this.assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}

this.maybeRequire = (module) => Meteor.isServer ? Npm.require(module) : null;

if (Meteor.isServer) {
  Meteor.npmRequire('es6-shim');
}

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
