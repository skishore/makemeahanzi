"use strict";

Session.setDefault('controls.show_editor', true);

Template.content.helpers({
  show_editor: function() {
    return Session.get('controls.show_editor');
  }
});

Template.controls.events({
  'click #backup-button': function() {
    Meteor.call('backup');
  },
  'click #restore-button': function() {
    Meteor.call('restore');
  },
});

Template.navbar.helpers({
  mode: function() {
    if (Session.get('controls.show_editor')) {
      return 'editor';
    }
    var radical = Session.get('gallery.radical');
    if (radical === undefined) {
      return 'all radicals';
    }
    return 'radical ' + radical;
  },
  percent: function() {
    var value = Session.get('glyph.fraction_verified');
    return Math.round(100*(value === undefined ? 0 : value));
  },
});
