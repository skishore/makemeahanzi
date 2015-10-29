"use strict";

Template.navbar.helpers({
  complete() {
    const progress = Progress.findOne();
    return progress ? progress.complete : '?';
  },
  percent() {
    const progress = Progress.findOne();
    return progress && progress.total ?
        Math.round(100*progress.complete/progress.total) : 0;
  },
  total() {
    const progress = Progress.findOne();
    return progress ? progress.total : '?';
  },
});

Meteor.startup(() => Meteor.subscribe('getProgress'));
