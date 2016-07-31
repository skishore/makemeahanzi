import {getPWD} from '/lib/base';
import {Progress} from '/lib/glyphs';

const child_process = Npm.require('child_process');
const path = Npm.require('path');

const getBackupPath = () => {
  return path.join(getPWD(), 'server', 'backup');
}

Meteor.methods({
  backup() {
    const path = getBackupPath();
    child_process.spawn('mongodump', ['--port', '3001', '--out', path]);
    Progress.update({}, {$set: {backup: true}});
  },
  restore() {
    const path = getBackupPath();
    child_process.spawn('mongorestore', ['--port', '3001', '--drop', path]);
  },
});
