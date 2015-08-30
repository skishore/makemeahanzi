Session.setDefault('glyph.data', undefined);
Session.setDefault('glyph.show_strokes', true);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];

function change_glyph(method) {
  var glyph = Session.get('glyph.data');
  var name = glyph ? glyph.name : undefined;
  Meteor.call(method, name, function(error, data) {
    Session.set('glyph.data', data);
    Session.set('glyph.show_strokes', true);
  });
}

function to_line(pairs) {
  return {x1: pairs[0][0], y1: pairs[0][1], x2: pairs[1][0], y2: pairs[1][1]};
}

function to_point(pair) {
  return {x: pair[0], y: pair[1]};
}

Glyphs.get = function(name) {
  Meteor.call('get_glyph', name, function(error, data) {
    Session.set('glyph.data', data);
  });
}

Template.glyph.helpers({
  glyph: function() {
    return !!Session.get('glyph.data');
  },
  base_color: function() {
    return Session.get('glyph.show_strokes') ? 'black' : 'gray';
  },
  d: function() {
    return Session.get('glyph.data').d;
  },
  show_strokes: function() {
    return !!Session.get('glyph.show_strokes');
  },
  strokes: function() {
    var glyph = Session.get('glyph.data');
    var result = [];
    var strokes = glyph.extractor.strokes;
    for (var i = 0; i < strokes.length; i++) {
      result.push({stroke: strokes[i], color: COLORS[i % COLORS.length]});
    }
    return result;
  },
  bridges: function() {
    return Session.get('glyph.data').extractor.bridges.map(to_line);
  },
  corners: function() {
    return Session.get('glyph.data').extractor.corners.map(to_point);
  },
  points: function() {
    return Session.get('glyph.data').extractor.points.map(to_point);
  },
});

Meteor.startup(function() {
  $('body').on('keypress', function(e) {
    var key = String.fromCharCode(e.which);
    if (key == 'a') {
      change_glyph('get_previous_glyph');
    } else if (key == 'd') {
      change_glyph('get_next_glyph');
    } else if (key == 'w' && Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', false);
    } else if (key == 's' && !Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', true);
    }
  });
  if (!Session.get('glyph.data')) {
    change_glyph('get_next_glyph');
  }
});
