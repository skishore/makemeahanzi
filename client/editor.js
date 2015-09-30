"use strict";

Session.set('editor.glyph', undefined);

let stage = new stages.AbstractStage;

const changeGlyph = (method, argument) => {
  argument = argument || Session.get('editor.glyph');
  Meteor.call(method, argument, function(err, data) {
    Session.set('editor.glyph', data);
    stage = new stages.strokes(data);
    stage.refresh();
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
    stage.handleEvent(event, this);
    stage.refresh();
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

Meteor.startup(function() {
  $('body').on('keypress', function(e) {
    var key = String.fromCharCode(e.which);
    if (bindings.hasOwnProperty(key)) {
      bindings[key]();
    }
  });
  cjklib.promise.then(initialize).catch(console.error.bind(console));
});
