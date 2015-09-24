"use strict";

this.assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}

this.maybeRequire = (module) => Meteor.isServer ? Npm.require(module) : null;
