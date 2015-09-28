"use strict";

Session.setDefault('editor.glyph', undefined);
Session.setDefault('glyph.selected_point', undefined);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];
var DICTIONARY = 'http://www.archchinese.com/chinese_english_dictionary.html';

function change_glyph(method, argument) {
  argument = argument || Session.get('editor.glyph');
  Meteor.call(method, argument, function(err, data) {
    Session.set('editor.glyph', data);
  });
}

window.get_glyph = function(name) {
  change_glyph('get_glyph', name);
}

function contains(bridges, bridge) {
  return remove_bridges(bridges, [bridge]).length < bridges.length;
}

function remove_bridges(add, remove) {
  var set = {};
  for (var i = 0; i < remove.length; i++) {
    set[to_line(remove[i]).coordinates] = true;
    set[to_line([remove[i][1], remove[i][0]]).coordinates] = true;
  }
  return add.filter(function(x) { return !set[to_line(x).coordinates]; });
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
    if (!EDIT_STROKES) {
      var glyph = Session.get('editor.glyph');
      var character = String.fromCodePoint(parseInt(glyph.name.substr(3), 16));
      window.open(DICTIONARY + '?find=' + character, '_blank').focus();
      return;
    }
    if (Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', false);
      Session.set('glyph.selected_point', undefined);
      var glyph = Session.get('editor.glyph');
      glyph.manual.verified = false;
      change_glyph('save_glyph', glyph);
    } else {
      var glyph = Session.get('editor.glyph');
      delete glyph.manual;
      Session.set('editor.glyph', fill_glyph_fields(glyph));
    }
  },
  'a': function() {
    change_glyph('get_previous_glyph');
  },
  'A': function() {
    change_glyph('get_previous_glyph_skip_verified');
  },
  's': function() {
    if (!EDIT_STROKES) {
      return;
    }
    var glyph = Session.get('editor.glyph');
    if (!Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', true);
      return;
    }
    if (glyph.manual.verified || !has_errors(glyph)) {
      glyph.manual.verified = !glyph.manual.verified;
      change_glyph('save_glyph', glyph);
    }
  },
  'd': function() {
    change_glyph('get_next_glyph');
  },
  'D': function() {
    change_glyph('get_next_glyph_skip_verified');
  },
};

/*
Template.controls.helpers({
  w_button_name: function() {
    if (!EDIT_STROKES) {
      return 'Check';
    }
    return Session.get('glyph.show_strokes') ? 'Edit' : 'Reset';
  },
  s_button_name: function() {
    return '(Error)';
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
    var xs = coordinates.split(',').map(function(x) {
      return parseInt(x, 10);
    });
    var bridge = [[xs[0], xs[1]], [xs[2], xs[3]]];
    var glyph = Session.get('glyph.data');
    glyph.manual.bridges = remove_bridges(glyph.manual.bridges, [bridge]);
    Session.set('glyph.data', fill_glyph_fields(glyph));
    Session.set('glyph.selected_point', undefined);
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
    var xs = (coordinates + ',' + selected_point).split(',').map(function(x) {
      return parseInt(x, 10);
    });
    var bridge = [[xs[0], xs[1]], [xs[2], xs[3]]];
    var glyph = Session.get('glyph.data');
    if (!contains(glyph.manual.bridges, bridge)) {
      glyph.manual.bridges.push(bridge);
      Session.set('glyph.data', fill_glyph_fields(glyph));
    }
    Session.set('glyph.selected_point', undefined);
  },
});
*/

Template.editor.helpers({
  class() {
    return undefined;
  },
  paths() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    const result = [];
    for (let i = 0; i < glyph.stages.strokes.length; i++) {
      result.push({
        cls: 'selectable',
        d: glyph.stages.strokes[i],
        fill: COLORS[i % COLORS.length],
        stroke: 'black',
      });
    }
    return result;
  },
  lines() {
    return;
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    var original = {};
    for (var i = 0; i < glyph.render.bridges.length; i++) {
      var bridge = glyph.render.bridges[i];
      original[to_line(bridge).coordinates] = true;
      original[to_line([bridge[1], bridge[0]]).coordinates] = true;
    }
    var result = [];
    for (var i = 0; i < glyph.manual.bridges.length; i++) {
      var line = to_line(glyph.manual.bridges[i]);
      line.color = original[line.coordinates] ? 'red' : 'purple';
      result.push(line);
    }
    return result;
  },
  points() {
    return;
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    var result = [];
    for (var i = 0; i < glyph.render.endpoints.length; i++) {
      var endpoint = glyph.render.endpoints[i];
      var point = to_point(endpoint.point);
      point.color = endpoint.corner ? 'red' : 'black';
      point.z_index = endpoint.corner ? 1 : 0;
      if (point.coordinates === Session.get('glyph.selected_point')) {
        point.color = 'purple';
      }
      result.push(point);
    }
    result.sort(function(p1, p2) { return p1.z_index - p2.z_index; });
    return result;
  },
});

Template.metadata.helpers({
  character() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    return glyph.character;
  },
  items() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    const defaults = cjklib.getCharacterData(glyph.character);
    const fields = ['definition', 'pinyin', 'strokes']
    return fields.map((x) => ({
      field: `${x[0].toUpperCase()}${x.substr(1)}:`,
      value: glyph.metadata[x] || defaults[x] || '(unknown)',
    }));
  },
});

Template.status.helpers({
  stage() {
    return 'strokes';
  },
  lines() {
    return [
      {cls: 'success', message: 'asdf'},
      {cls: 'error', message: 'asdf asdf'},
      {message: 'asdf asdf asdf asdf asdf asdf asdf asdf asdf asd fasd fasd fasd fas dfa sdfa sdf'},
    ];
  },
});

Meteor.startup(function() {
  $('body').on('keypress', function(e) {
    var key = String.fromCharCode(e.which);
    if (bindings.hasOwnProperty(key)) {
      bindings[key]();
    }
  });
  cjklib.promise.then(() => change_glyph('get_next_glyph'))
                .catch(console.error.bind(console));
});
