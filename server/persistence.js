"use strict";

const child_process = Npm.require('child_process');
const path = Npm.require('path');

const getBackupPath = () => {
  // TODO(skishore): The next line makes assumptions about the Meteor build
  // directory's structure. We should replace it with a Meteor-provided API.
  let pwd = path.join(process.cwd(), '../../../..');
  if (process.env && process.env.PWD) {
    pwd = process.env.PWD;
  }
  return path.join(pwd, 'server', 'backup');
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
