"use strict";

Session.set('editor.glyph', undefined);

const types = ['path', 'bridges', 'strokes', 'analysis', 'order', 'settled'];
let last_glyph = undefined;
let stage = new stages.AbstractStage;

const changeGlyph = (method, argument) => {
  argument = argument || Session.get('editor.glyph');
  Meteor.call(method, argument, function(error, data) {
    assert(!error);
    Session.set('editor.glyph', data);
  });
}

const constructStage = (type) => {
  const glyph = Session.get('editor.glyph');
  stage = new stages[type](glyph);
  Session.set('editor.glyph', glyph);
  stage._type = type;
  stage.refresh(glyph);
}

this.getGlyph = (selector) => changeGlyph('getGlyph', selector);

const incrementStage = (amount) => {
  const index = types.indexOf(stage._type);
  if (index < 0) return;
  const new_index = index + amount;
  if (new_index < 0 || new_index >= types.length) return;
  constructStage(types[new_index]);
}

const initialize = () => {
  const glyph = Session.get('editor.glyph');
  if (glyph === undefined) {
    //changeGlyph('getNextGlyph');
    getGlyph({character: '黽'});
  } else {
    getGlyph({character: glyph.character});
  }
}

const bindings = {
  a: () => changeGlyph('getPreviousGlyph'),
  w: () => incrementStage(-1),
  d: () => changeGlyph('getNextGlyph'),
  s: () => incrementStage(1),
};

Template.editor.events({
  'click svg .selectable': function(event) {
    // We avoid the arrow function here so that this is bound to the template.
    const glyph = Session.get('editor.glyph');
    stage.handleEvent(glyph, event, this);
    Session.set('editor.glyph', glyph);
  }
});

Template.editor.helpers({
  paths: () => Session.get('stage.paths'),
  lines: () => Session.get('stage.lines'),
  points: () => Session.get('stage.points'),
});

Template.status.helpers({
  stage: () => Session.get('stage.type'),
  template: () => `${Session.get('stage.type')}_stage`,
  lines: () => Session.get('stage.status'),
});

Tracker.autorun(() => {
  const glyph = Session.get('editor.glyph');
  if (!glyph) return;
  if (!last_glyph || glyph.character !== last_glyph.character) {
    let last_completed_stage = types[0];
    types.map((x) => { if (glyph.stages[x]) last_completed_stage = x; });
    constructStage(last_completed_stage);
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
