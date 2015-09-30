"use strict";

Session.set('editor.glyph', undefined);

let last_glyph = undefined;
let stage = new stages.AbstractStage;

const changeGlyph = (method, argument) => {
  argument = argument || Session.get('editor.glyph');
  Meteor.call(method, argument, function(error, data) {
    assert(!error);
    Session.set('editor.glyph', data);
  });
}

this.getGlyph = (selector) => changeGlyph('getGlyph', selector);

const initialize = () => {
  const glyph = Session.get('editor.glyph');
  if (glyph === undefined) {
    changeGlyph('getNextGlyph');
  } else {
    getGlyph({character: glyph.character});
  }
}

const bindings = {
  a: () => changeGlyph('getPreviousGlyph'),
  d: () => changeGlyph('getNextGlyph'),
};

Template.editor.events({
  'click svg .selectable': function(event) {
    // We avoid the arrow function here so that this is bound to the template.
    stage.handleEvent(Session.get('editor.glyph'), event, this);
  }
});

Template.editor.helpers({
  stage: () => Session.get('stage.type'),
  paths: () => Session.get('stage.paths'),
  lines: () => Session.get('stage.lines'),
  points: () => Session.get('stage.points'),
});

Template.status.helpers({
  stage: () => Session.get('stage.type'),
  instructions: () => Session.get('stage.instructions'),
  lines: () => Session.get('stage.status'),
});

Tracker.autorun(() => {
  const glyph = Session.get('editor.glyph');
  if (!glyph) return;
  if (!last_glyph || glyph.character !== last_glyph.character) {
    stage = new stages.bridges(glyph);
  }
  stage.refresh(glyph);
  last_glyph = glyph;
});

Meteor.startup(() => {
  $('body').on('keypress', (event) => {
    const key = String.fromCharCode(event.which);
    if (bindings.hasOwnProperty(key)) {
      bindings[key]();
    } else if ('1' <= key && key <= '9') {
      const index = key.charCodeAt(0) - '1'.charCodeAt(0);
      const href = $('.metadata .reference')[index].href;
      window.open(href, '_blank').focus();
    }
  });
  cjklib.promise.then(initialize).catch(console.error.bind(console));
});
