var child_process = Npm.require('child_process');
var path = Npm.require('path');

function get_glyph_data(characters) {
  var json = '';
  var font = path.join(process.env.PWD, 'derived', 'ukai.svg');
  var main = path.join(process.env.PWD, 'scripts', 'main.py');
  var child = child_process.spawn(main, ['-f', font].concat(characters));
  child.stdout.on('data', function(data) {
    json += data;
  });
  child.stderr.on('data', function(data) {
    console.error('' + data);
  });
  child.on('close', function(code) {
    console.log('Subprocess exited with code: ' + code);
    console.log('Got JSON data:');
    return JSON.parse(json);
  });
}

Meteor.startup(function() {
  get_glyph_data(['4dff', '4e00', '4e01']);
});
