var child_process = Npm.require('child_process');
var path = Npm.require('path');

function get_backup_path() {
  return path.join(process.env.PWD, 'server', 'backup');
}

Meteor.methods({
  backup: function() {
    var path = get_backup_path();
    child_process.spawn('mongodump', ['--port', '3001', '--out', path]);
  },
  restore: function() {
    var path = get_backup_path();
    child_process.spawn('mongorestore', ['--port', '3001', '--drop', path]);
  },
  wipe: function() {
    base.collection.remove({});
  },
});
