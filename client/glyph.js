Session.setDefault('glyph.data', undefined);
Session.setDefault('glyph.show_strokes', true);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];

function change_glyph(method, glyph) {
  glyph = glyph || Session.get('glyph.data');
  Meteor.call(method, glyph, function(error, data) {
    data.manual = data.manual || {};
    data.manual.bridges_added = data.manual.bridges_added || [];
    data.manual.bridges_removed = data.manual.bridges_removed || [];
    data.manual.verified = data.manual.verified || false;
    Session.set('glyph.data', data);
    if (method != 'save_glyph') {
      Session.set('glyph.show_strokes', true);
    }
  });
}

function to_line(pairs) {
  return {
    x1: pairs[0][0],
    y1: pairs[0][1],
    x2: pairs[1][0],
    y2: pairs[1][1],
    coordinates: pairs[0].join(',') + ',' + pairs[1].join(','),
  };
}

function to_point(pair) {
  return {x: pair[0], y: pair[1], coordinates: pair.join(',')};
}

var bindings = {
  'w': function() {
    if (Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', false);
    } else {
      var glyph = Session.get('glyph.data');
      delete glyph.manual;
      change_glyph('save_glyph', glyph);
    }
  },
  'a': function() {
    change_glyph('get_previous_glyph');
  },
  'A': function() {
    change_glyph('get_previous_glyph_skip_verified');
  },
  's': function() {
    if (!Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', true);
      return;
    }
    var glyph = Session.get('glyph.data');
    glyph.manual.verified = !glyph.manual.verified;
    change_glyph('save_glyph', glyph);
  },
  'd': function() {
    change_glyph('get_next_glyph');
  },
  'D': function() {
    change_glyph('get_next_glyph_skip_verified');
  },
};

Template.controls.events({
  'click #w-button': bindings.w,
  'click #a-button': bindings.a,
  'click #s-button': bindings.s,
  'click #d-button': bindings.d,
});

Template.controls.helpers({
  w_button_name: function() {
    return Session.get('glyph.show_strokes') ? 'Edit' : 'Reset';
  },
  s_button_name: function() {
    if (!Session.get('glyph.show_strokes')) {
      return 'View';
    }
    var glyph = Session.get('glyph.data');
    return glyph && glyph.manual.verified ? 'Flag' : 'Verify';
  },
});

Template.glyph.helpers({
  glyph: function() {
    return !!Session.get('glyph.data');
  },
  verified: function() {
    var glyph = Session.get('glyph.data');
    return glyph && glyph.manual.verified ? 'verified' : undefined;
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
    if (bindings.hasOwnProperty(key)) {
      bindings[key]();
    }
  });
  if (!Session.get('glyph.data')) {
    change_glyph('get_next_glyph');
  }
});
