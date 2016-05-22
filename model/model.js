// A small set of static helper methods used to implement model logic.
// The most important methods here are autorun and startup, which have the
// same contract as Tracker.autorun and Meteor.startup but wait for the
// database to be ready before executing.
const collections = {};

class Model {
  static autorun(callback) {
    Meteor.startup(() => Tracker.autorun(() =>
        Meteor.isClient && Ground.ready() && callback()));
  }
  static collection(name) {
    collections[name] = new Ground.Collection(name, {connection: null});
    return collections[name];
  }
  static startup(callback) {
    this.autorun(() => Meteor.setTimeout(() => callback()));
  }
  static timestamp() {
    return Math.floor(new Date().getTime() / 1000);
  }
}

// Expose the collections for easy debugging.
if (Meteor.isClient) window.collections = collections;

export {Model}
