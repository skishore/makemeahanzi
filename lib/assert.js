"use strict";

this.assert = function(condition, message) {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}
