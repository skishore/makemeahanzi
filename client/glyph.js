Session.setDefault('glyph.data', undefined);
Session.setDefault('glyph.selected_point', undefined);
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

window.get_glyph = function(name) {
  change_glyph('get_glyph', name);
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
      Session.set('glyph.selected_point', undefined);
      var glyph = Session.get('glyph.data');
      glyph.manual.verified = false;
      Session.set('glyph.data', glyph);
      change_glyph('save_glyph', glyph);
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
    Session.set('glyph.data', glyph);
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

Template.glyph.events({
  'click #glyph svg g line': function(e) {
    var coordinates = $(e.target).attr('data-coordinates');
    var glyph = Session.get('glyph.data');
    var found_manual_bridge = false;
    for (var i = 0; i < glyph.manual.bridges_added.length; i++) {
      var bridge = glyph.manual.bridges_added[i];
      if (to_line(bridge).coordinates === coordinates) {
        glyph.manual.bridges_added.splice(i, 1);
        glyph.manual.verified = false;
        change_glyph('save_glyph', glyph);
        return;
      }
    }
    var xs = coordinates.split(',').map(function(x) {
      return parseInt(x, 10);
    });
    glyph.manual.bridges_removed.push([[xs[0], xs[1]], [xs[2], xs[3]]]);
    glyph.manual.verified = false;
    change_glyph('save_glyph', glyph);
  },
  'click #glyph svg g circle': function(e) {
    var coordinates = $(e.target).attr('data-coordinates');
    var selected_point = Session.get('glyph.selected_point');
    if (selected_point === coordinates) {
      Session.set('glyph.selected_point', undefined);
      return;
    } else if (!selected_point) {
      Session.set('glyph.selected_point', coordinates);
      return;
    }
    Session.set('glyph.selected_point', undefined);
    var option1 = selected_point + ',' + coordinates;
    var option2 = coordinates + ',' + selected_point;
    // If it's a removed bridge, add it back.
    var glyph = Session.get('glyph.data');
    for (var i = 0; i < glyph.manual.bridges_removed.length; i++) {
      var removed_coordinates =
          to_line(glyph.manual.bridges_removed[i]).coordinates;
      if (removed_coordinates === option1 || removed_coordinates === option2) {
        glyph.manual.bridges_removed.splice(i, 1);
        glyph.manual.verified = false;
        change_glyph('save_glyph', glyph);
        return;
      }
    }
    // We're adding a new bridge. Check that it doesn't exist.
    var existing_bridges =
        [].concat(glyph.extractor.bridges).concat(glyph.manual.bridges_added);
    for (var i = 0; i < existing_bridges.length; i++) {
      var existing_coordinates = to_line(existing_bridges[i]).coordinates;
      if (existing_coordinates === option1 ||
          existing_coordinates === option2) {
        console.log('Skipping existing bridge.');
        return;
      }
    }
    // Add in the brand new bridge.
    var xs = option1.split(',').map(function(x) {
      return parseInt(x, 10);
    });
    glyph.manual.bridges_added.push([[xs[0], xs[1]], [xs[2], xs[3]]]);
    glyph.manual.verified = false;
    change_glyph('save_glyph', glyph);
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
    var glyph = Session.get('glyph.data');
    var removed = {};
    for (var i = 0; i < glyph.manual.bridges_removed.length; i++) {
      removed[to_line(glyph.manual.bridges_removed[i]).coordinates] = true;
    }
    var result = [];
    for (var i = 0; i < glyph.extractor.bridges.length; i++) {
      var line = to_line(glyph.extractor.bridges[i]);
      if (!removed[line.coordinates]) {
        line.color = 'red';
        result.push(line);
      }
    }
    for (var i = 0; i < glyph.manual.bridges_added.length; i++) {
      var line = to_line(glyph.manual.bridges_added[i]);
      line.color = 'purple';
      result.push(line);
    }
    return result;
  },
  points: function() {
    var glyph = Session.get('glyph.data');
    var corners = {};
    for (var i = 0; i < glyph.extractor.corners.length; i++) {
      corners[to_point(glyph.extractor.corners[i]).coordinates] = true;
    }
    var result = [];
    for (var i = 0; i < glyph.extractor.points.length; i++) {
      var point = to_point(glyph.extractor.points[i]);
      point.color = corners[point.coordinates] ? 'red' : 'black';
      point.z_index = corners[point.coordinates] ? 1 : 0;
      if (point.coordinates === Session.get('glyph.selected_point')) {
        point.color = 'purple';
      }
      result.push(point);
    }
    result.sort(function(p1, p2) { return p1.z_index - p2.z_index; });
    return result;
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
