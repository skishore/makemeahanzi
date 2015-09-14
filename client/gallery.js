var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];
var DICTIONARY = 'http://www.archchinese.com/chinese_english_dictionary.html';

var subscription = undefined;

function comparison(glyph1, glyph2) {
  if (glyph1.derived.strokes.length !== glyph2.derived.strokes.length) {
    return glyph1.derived.strokes.length - glyph2.derived.strokes.length;
  } else if (glyph1.index.radical !== glyph2.index.radical) {
    return glyph1.index.radical - glyph2.index.radical;
  }
  return glyph1.name < glyph2.name ? -1 : 1;
}

Template.gallery.events({
  'click svg.radical': function(e) {
    window.location.hash = this.radical;
  },
  'click svg.character': function(e) {
    var character = String.fromCodePoint(parseInt(this.name.substr(3), 16));
    window.open(DICTIONARY + '?find=' + character, '_blank').focus();
  },
});

Template.gallery.helpers({
  blocks: function() {
    if (!Session.get('gallery.ready')) {
      return [];
    }
    var glyphs = Glyphs.find().fetch().sort(comparison);
    var on_radicals_page = Session.get('gallery.radical') === undefined;
    var last_num_strokes = -1;
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
      var data = {
        class: (on_radicals_page ? 'radical' : 'character'),
        d: Glyphs.get_svg_path(glyph),
        name: glyph.name,
        radical: glyph.index.radical,
        strokes: strokes
      };
      var num_strokes =
          on_radicals_page ? glyph.derived.strokes.length : glyph.index.strokes;
      if (num_strokes != last_num_strokes) {
        result.push({glyphs: [], count: num_strokes});
        last_num_strokes = num_strokes;
      }
      result[result.length - 1].glyphs.push(data);
    }
    return result;
  },
  loading: function() {
    return !Session.get('gallery.ready');
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

window.onhashchange = function() {
  var hash = parseInt(window.location.hash.substr(1), 10);
  if (isNaN(hash)) {
    Session.set('gallery.radical', undefined);
  } else {
    Session.set('gallery.radical', hash);
  }
  Session.set('gallery.ready', false);
  if (subscription) {
    subscription.stop();
  }
}

Meteor.startup(function() {
  window.onhashchange();
  Tracker.autorun(function() {
    var radical = Session.get('gallery.radical')
    subscription = Meteor.subscribe('index', radical, function() {
      Session.set('gallery.ready', true);
    });
  });
});
