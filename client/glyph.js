Session.setDefault('glyph.data', undefined);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];
var SCALE = 0.16;
var SIZE = Math.floor(1024*SCALE);
var TRANSFORM = 'scale(' + SCALE + ', -' + SCALE + ') translate(0, -900)'

function next_glyph() {
  var glyph = Session.get('glyph.data');
  var name = glyph ? glyph.name : undefined;
  Meteor.call('get_next_glyph', name, function(error, data) {
    Session.set('glyph.data', data);
  });
}
window.next_glyph = next_glyph;

Template.glyph.helpers({
  size: function() {
    return SIZE;
  },
  transform: function() {
    return TRANSFORM;
  },
  d: function() {
    var glyph = Session.get('glyph.data');
    return glyph ? glyph.d : undefined;
  },
  strokes: function() {
    var glyph = Session.get('glyph.data');
    if (!glyph) {
      return [];
    }
    var result = [];
    var strokes = glyph.extractor.strokes;
    for (var i = 0; i < strokes.length; i++) {
      result.push({stroke: strokes[i], color: COLORS[i % COLORS.length]});
    }
    return result;
  },
});

Meteor.startup(function() {
  next_glyph();
});
