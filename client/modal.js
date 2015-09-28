"use strict";

var BATCH_SIZE = 64;
var CODEPOINTS = [0x2e80, 0x2fdf];
var FONT_LOADED_PROGRESS = 0.1;

/*
Template.controls.events({
  'click #reload-button': function() {
    const characters_to_save =
        new Set(Object.keys(cjklib.radicals.radical_to_index_map)
                      .filter((radical) => !cjklib.gb2312[radical]));
    const characters_found = new Set;

    Session.set('modal.value', 0);
    opentype.load('arphic/UKaiCN.ttf', function(err, font) {
      if (err) {
        console.log('Error loading font: ' + err);
        return;
      }
      Session.set('modal.value', FONT_LOADED_PROGRESS);
      var glyphs_to_save = [];

      for (var i = 0; i < font.glyphs.length; i++) {
        var glyph = font.glyphs.glyphs[i];
        const unicode = String.fromCodePoint(glyph.unicode || 0);
        if (characters_to_save.has(unicode)) {
          var name = 'uni' + glyph.unicode.toString(16).toUpperCase();
          glyphs_to_save.push({name: name, path: glyph.path.commands});
          characters_found.add(unicode);
        }
      }

      console.log('Missing radicals:', Array.from(characters_to_save).filter(
                                           (x) => !characters_found.has(x)));
      save_glyphs(glyphs_to_save);
    });
  },
});

function save_glyphs(glyphs, index) {
  index = index || 0;
  if (index >= glyphs.length) {
    Session.set('modal.value', undefined);
    return;
  }
  var remainder = (1 - FONT_LOADED_PROGRESS)*index/glyphs.length;
  Session.set('modal.value', remainder + FONT_LOADED_PROGRESS);
  var max = Math.min(index + BATCH_SIZE, glyphs.length);
  var batch = [];
  for (var i = index; i < max; i++) {
    batch.push(glyphs[i]);
  }
  Meteor.call('save_glyphs', batch, function(err, result) {
    Meteor.setTimeout(function() { save_glyphs(glyphs, max); }, 0);
  });
}
*/

Template.modal.helpers({
  percent: function() {
    var value = Session.get('modal.value');
    return Math.round(100*(value === undefined ? 1 : value));
  },
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
