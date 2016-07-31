import {Progress} from '/lib/glyphs';

Template.navbar.events({
  'click .backup': () => {
    const progress = Progress.findOne();
    if (!(progress && progress.backup)) {
      Meteor.call('backup');
    }
  },
});

Template.navbar.helpers({
  backup() {
    const progress = Progress.findOne();
    return (progress && progress.backup) ? 'disabled' : undefined;
  },
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
