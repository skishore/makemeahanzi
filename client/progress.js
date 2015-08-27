Template.navbar.events({
  'click #reload-button': function() {
    Meteor.call('reload');
  },
});

Template.progress.helpers({
  percent: function() {
    return Math.round(100*Session.get('progress.value'));
  },
});

Tracker.autorun(function() {
  if (Session.get('progress.show')) {
    $('#progress').modal({background: 'static', keyboard: false});
  } else {
    $('#progress').modal('hide');
  }
});

Tracker.autorun(function() {
  var progress = Progress.findOne();
  if (progress) {
    Session.set('progress.show', true);
    Session.set('progress.value', progress.value);
  } else {
    Session.set('progress.show', false);
  }
});

Meteor.subscribe('progress');
