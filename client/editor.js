"use strict";

Session.set('editor.glyph', undefined);

const types = ['path', 'bridges', 'strokes', 'analysis', 'order', 'verified'];
let last_glyph = undefined;
let stage = new stages.AbstractStage;

const changeGlyph = (method, argument) => {
  argument = argument || Session.get('editor.glyph');
  Meteor.call(method, argument, function(error, data) {
    assert(!error, error);
    Session.set('editor.glyph', data);
    window.location.hash = data.character;
  });
}

const clearStageSessionKeys = (type) => {
  Object.keys(Session.keys).filter((x) => x.startsWith(`stages.${type}.`))
                           .map((x) => Session.set(x, undefined));
}

const constructStage = (type) => {
  const glyph = Session.get('editor.glyph');
  const current = glyph.stages[type];
  if (!current || current.sentinel) {
    glyph.stages[type] = null;
  }
  clearStageSessionKeys(stage.type);
  stage = new stages[type](glyph);
  assert(stage.type === type);
  stage.forceRefresh = forceRefresh;
  stage.forceRefresh(true /* from_construct_stage */);
}

const forceRefresh = (from_construct_stage) => {
  const glyph = Session.get('editor.glyph');
  stage.refreshUI(glyph.character, glyph.metadata);
  let output = stage.getStageOutput();
  const current = glyph.stages[stage.type];
  if (from_construct_stage && (!current || current.sentinel)) {
    output = {sentinel: true};
  }
  if (!_.isEqual(output, current)) {
    glyph.stages[stage.type] = output;
    if (!output || !current || stage.clearLaterStages(output, current)) {
      for (let i = types.indexOf(stage.type) + 1; i < types.length; i++) {
        glyph.stages[types[i]] = null;
      }
    }
    Session.set('editor.glyph', glyph);
  }
}

const incrementStage = (amount) => {
  const index = types.indexOf(stage.type);
  if (index < 0) return;
  const new_index = index + amount;
  if (new_index < 0 || new_index >= types.length) return;
  if (amount > 0) {
    stage.validate();
    stage.forceRefresh();
  }
  constructStage(types[new_index]);
}

const loadCharacter = () => {
  const character = window.location.hash[1];
  const glyph = Session.get('editor.glyph');
  if (!character) {
    changeGlyph('getNextGlyph');
  } else if (!glyph || glyph.character !== character) {
    changeGlyph('getGlyph', character);
  }
}

const resetStage = () => {
  const glyph = Session.get('editor.glyph');
  glyph.stages[stage.type] = null;
  Session.set('editor.glyph', glyph);
  constructStage(stage.type);
}

const bindings = {
  a: () => changeGlyph('getPreviousGlyph'),
  A: () => changeGlyph('getPreviousUnverifiedGlyph'),
  q: () => changeGlyph('getPreviousVerifiedGlyph'),
  d: () => changeGlyph('getNextGlyph'),
  D: () => changeGlyph('getNextUnverifiedGlyph'),
  e: () => changeGlyph('getNextVerifiedGlyph'),
  r: resetStage,
  s: () => incrementStage(1),
  w: () => incrementStage(-1),
};

// We avoid arrow functions in this map so that this is bound to the template.
Template.editor.events({
  'click svg .selectable': function(event) {
    stage.handleEvent(event, this);
    stage.forceRefresh();
  }
});

Template.editor.helpers({
  paths: () => Session.get('stage.paths'),
  lines: () => Session.get('stage.lines'),
  points: () => Session.get('stage.points'),
  animations: () => Session.get('stage.animations'),
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
  } else {
    Meteor.call('saveGlyph', glyph,
                (error, data) => { if (error) console.error(error) });
    if (!_.isEqual(glyph.metadata, last_glyph.metadata)) {
      stage.refreshUI(glyph.character, glyph.metadata);
    }
  }
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
  $(window).on('hashchange', loadCharacter);
  cjklib.promise.then(loadCharacter).catch(console.error.bind(console));
});
