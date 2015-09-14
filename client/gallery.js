Session.setDefault('gallery.radical', undefined);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];

function comparison(glyph1, glyph2) {
  if (glyph1.index.strokes === glyph2.index.strokes) {
    return glyph1.index.radical - glyph2.index.radical;
  }
  return glyph1.index.strokes - glyph2.index.strokes;
}

Template.gallery.events({
  'click svg.radical': function(e) {
    Session.set('gallery.radical', this.radical);
  },
});

Template.gallery.helpers({
  glyphs: function() {
    var glyphs = Glyphs.find().fetch().sort(comparison);
    var on_radicals_page = Session.get('gallery.radical') === undefined;
    var result = [];
    for (var i = 0; i < glyphs.length; i++) {
      var glyph = glyphs[i];
      if (on_radicals_page && i > 0 &&
          glyph.index.radical === glyphs[i - 1].index.radical) {
        continue;
      }
      var strokes = [];
      if (!on_radicals_page) {
        for (var j = 0; j < glyph.derived.strokes.length; j++) {
          var stroke = glyph.derived.strokes[j];
          strokes.push({color: COLORS[j % COLORS.length], stroke: stroke});
        }
      }
      result.push({
        class: (on_radicals_page ? 'radical' : 'character'),
        d: Glyphs.get_svg_path(glyph),
        radical: glyph.index.radical,
        strokes: strokes
      });
    }
    return result;
  },
});

Template.navbar.helpers({
  gallery: function() {
    var radical = Session.get('gallery.radical');
    if (radical === undefined) {
      return 'all radicals';
    }
    return 'radical ' + radical;
  },
});

Tracker.autorun(function() {
  Meteor.subscribe('index', Session.get('gallery.radical'));
});
