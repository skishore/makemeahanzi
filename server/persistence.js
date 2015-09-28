"use strict";

const child_process = Npm.require('child_process');
const path = Npm.require('path');

const getBackupPath = () => path.join(process.env.PWD, 'server', 'backup');

Meteor.methods({
  backup() {
    const path = getBackupPath();
    child_process.spawn('mongodump', ['--port', '3001', '--out', path]);
  },
  restore() {
    const path = getBackupPath();
    child_process.spawn('mongorestore', ['--port', '3001', '--drop', path]);
  },
});
