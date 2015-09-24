"use strict";

this.assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}
