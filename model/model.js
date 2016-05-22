// A small set of static helper methods used to implement model logic.
// The most important methods here are autorun and startup, which have the
// same contract as Tracker.autorun and Meteor.startup but wait for the
// database to be ready before executing.

class Model {
  static autorun(callback) {
    Meteor.startup(() => Tracker.autorun(() =>
        Meteor.isClient && Ground.ready() && callback()));
  }
  static collection(name) {
    return new Ground.Collection(name, {connection: null});
  }
  static startup(callback) {
    this.autorun(() => Meteor.setTimeout(() => callback()));
  }
  static timestamp() {
    return Math.floor(new Date().getTime() / 1000);
  }
}

export {Model}
