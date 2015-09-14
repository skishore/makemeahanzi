function initialize_radicals(verbose) {
  var num_radicals = 214;
  var radicals = [];
  var radical_used = [];
  for (var i = 0; i < num_radicals; i++) {
    radicals.push(undefined);
    radical_used.push(undefined);
  }

  var names = Glyphs.find({}, {fields: {name: 1}, sort: {name: 1}}).fetch();
  for (var i = 0; i < names.length; i++) {
    var name = names[i].name;
    assert(UNIHAN_RADICAL_STROKE_INDEX.hasOwnProperty(name), name);
    var index = UNIHAN_RADICAL_STROKE_INDEX[name];
    assert(1 <= index[0] && index[0] <= num_radicals);
    if (index[1] === 0) {
      if (radicals[index[0] - 1] !== undefined) {
        if (verbose) {
          console.log('Duplicate glyph for radical ' + index[0] + ': ' +
                      radicals[index[0] - 1] + ', ' + name);
        }
      } else {
        radicals[index[0] - 1] = name;
      }
    }
    radical_used[index[0] - 1] = name;
    Glyphs.update({name: name},
                  {$set: {index: {radical: index[0], strokes: index[1]}}});
  }

  for (var i = 0; i < num_radicals; i++) {
    if (verbose && radicals[i] === undefined) {
      console.log('Did not find a glyph for radical ' + (i + 1));
      if (radical_used[i] !== undefined) {
        console.log('...but the radical was used in ' + radical_used[i]);
      }
    }
  }
}

Meteor.publish('index', function(radical) {
  return Glyphs.findGlyphsForRadical(radical);
});
