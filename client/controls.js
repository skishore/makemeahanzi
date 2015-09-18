var BATCH_SIZE = 64;
var CODEPOINTS = [0x4e00, 0x9fff];
var FONT_LOADED_PROGRESS = 0.1;

Session.setDefault('controls.show_editor', false);

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
  'click #reload-button': function() {
    Session.set('progress.value', 0);
    opentype.load('external/gkai00mp.ttf', function(err, font) {
      if (err) {
        console.log('Error loading font: ' + err);
        return;
      }
      Session.set('progress.value', FONT_LOADED_PROGRESS);
      var glyphs_to_save = [];
      for (var i = 0; i < font.glyphs.length; i++) {
        var glyph = font.glyphs.glyphs[i];
        if (CODEPOINTS[0] <= glyph.unicode && glyph.unicode <= CODEPOINTS[1]) {
          var name = 'uni' + glyph.unicode.toString(16).toUpperCase();
          glyphs_to_save.push({name: name, path: glyph.path.commands});
        }
      }
      save_glyphs(glyphs_to_save);
    });
  },
});

function save_glyphs(glyphs, index) {
  index = index || 0;
  if (index >= glyphs.length) {
    Session.set('progress.value', undefined);
    return;
  }
  var remainder = (1 - FONT_LOADED_PROGRESS)*index/glyphs.length;
  Session.set('progress.value', remainder + FONT_LOADED_PROGRESS);
  var max = Math.min(index + BATCH_SIZE, glyphs.length);
  var batch = [];
  for (var i = index; i < max; i++) {
    batch.push(glyphs[i]);
  }
  Meteor.call('save_glyphs', batch, function(err, result) {
    Meteor.setTimeout(function() { save_glyphs(glyphs, max); }, 0);
  });
}

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


Template.progress.helpers({
  percent: function() {
    var value = Session.get('progress.value');
    return Math.round(100*(value === undefined ? 1 : value));
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
  var progress = Session.get('progress.value');
  Session.set('progress.show', progress !== undefined);
});

Meteor.startup(function() {
  Session.set('progress.show', false);
  Session.set('progress.value', undefined);
});
