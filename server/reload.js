var child_process = Npm.require('child_process');
var path = Npm.require('path');

var BATCH_SIZE = 64;
var FONT_NAME = 'gkai.svg';
var GLYPH_RANGE = [0x4e00, 0x9fff];

var reloading = false;

function get_glyph_data(characters, manual, callback) {
  var json = '';
  var font = path.join(process.env.PWD, 'derived', FONT_NAME);
  var main = path.join(process.env.PWD, 'scripts', 'main.py');
  var args = ['-f', font].concat(characters);
  if (manual) {
    args = args.concat(['-m', JSON.stringify(manual)]);
  }
  var child = child_process.spawn(main, args);
  child.stdout.on('data', Meteor.bindEnvironment(function(data) {
    json += data;
  }));
  child.stderr.on('data', Meteor.bindEnvironment(function(data) {
    console.error('' + data);
  }));
  child.on('close', Meteor.bindEnvironment(function(code) {
    var glyphs = [];
    try {
      glyphs = JSON.parse(json);
    } catch (e) {
      console.error(e);
      glyphs.length = 0;
    }
    callback(code === 0 ? null : 'child_process error: ' + code, glyphs);
  }));
}

function iterate(start, end, index) {
  index = index || start;
  if (index >= end) {
    Progress.remove({});
    reloading = false;
    return;
  }
  Progress.upsert({}, {value: (index - start)/(end - start)});
  var max = Math.min(index + BATCH_SIZE, end);
  var characters = [];
  for (var i = index; i < max; i++) {
    characters.push(i.toString(16));
  }
  get_glyph_data(characters, function(error, glyphs) {
    for (var i = 0; i < glyphs.length; i++) {
      var glyph = glyphs[i];
      Glyphs.upsert({name: glyph.name}, glyph);
    }
    Meteor.setTimeout(function() { iterate(start, end, max); }, 0);
  });
}

Meteor.methods({
  reload: function() {
    if (!reloading) {
      iterate(GLYPH_RANGE[0], GLYPH_RANGE[1]);
      reloading = true;
    }
  },
  save_glyph: function(glyph) {
    var manual = glyph.manual || {};
    var characters = [glyph.name.substr(1).toLowerCase()];
    var result = Meteor.wrapAsync(get_glyph_data)(characters, manual)[0];
    result.manual = manual;
    Glyphs.upsert({name: result.name}, result);
    return result;
  },
});

Meteor.publish('progress', function() {
  return Progress.find();
});

Meteor.startup(function() {
  Progress.remove({});
  Glyphs._ensureIndex({name: 1}, {unique: true});
});
