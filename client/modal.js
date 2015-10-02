"use strict";

Template.modal.helpers({
  percent: () => {
    const value = Session.get('modal.value');
    return Math.round(100*(value === undefined ? 1 : value));
  },
  text: () => Session.get('modal.text'),
});

Tracker.autorun(function() {
  if (Session.get('modal.show')) {
    $('#modal').modal({background: 'static', keyboard: false});
  } else {
    $('#modal').modal('hide');
  }
});

Tracker.autorun(function() {
  const value = Session.get('modal.value');
  Session.set('modal.show', value !== undefined);
});

Meteor.startup(function() {
  Session.set('modal.show', false);
  Session.set('modal.value', undefined);
});
