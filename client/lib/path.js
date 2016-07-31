import opentype from '/client/external/opentype/0.4.10/opentype';

import {AbstractStage} from '/client/lib/abstract';
import {assert, Point} from '/lib/base';
import {Glyphs} from '/lib/glyphs';
import {svg} from '/lib/svg';

let stage = undefined;

class PathStage extends AbstractStage {
  constructor(glyph) {
    super('path');
    this.adjusted = glyph.stages.path;
    this.character = glyph.character;
    this.alternative = undefined;
    this.error = 'No path data.';
    stage = this;
  }
  onGetPath(error, path) {
    Session.set('modal.value', undefined);
    this.adjusted = path;
    this.error = error;
    this.forceRefresh();
  }
  refreshUI() {
    const d = this.adjusted;
    Session.set('stage.paths', [{d: d, fill: 'gray', stroke: 'gray'}]);
    Session.set(
      'stage.status',
      d ? [{cls: 'success', message: 'Got path data.'}]
        : [{cls: 'error', message: this.error}]);
    Session.set('stages.path.alternative', this.alternative);
  }
}

// We avoid arrow functions in this map so that this is bound to the template.
Template.path_stage.events({
  'blur .value': function(event) {
    const text = $(event.target).text();
    const value = text.length === 1 && text !== '?' ? text : undefined;
    if (value === stage.alternative) {
      $(event.target).text(value || '?');
    } else {
      stage.alternative = value;
      stage.forceRefresh();
    }
  },
  'click .option': function(event) {
    const label = this.label;
    const character = stage.character;
    assert(character.length === 1);
    Session.set('modal.text', `Loading ${label}...`);
    Session.set('modal.value', 0);
    opentype.load(this.font, (error, font) => {
      stage.alternative = undefined;
      if (error) {
        stage.onGetPath(`Error loading ${label}: ${error}`);
        return;
      }
      Session.set('modal.text', `Extracting ${character} from ${label}...`);
      Session.set('modal.value', 0.5);
      const index = font.charToGlyphIndex(character);
      const glyph = font.glyphs.get(index);
      if (glyph.unicode !== character.codePointAt(0)) {
        stage.onGetPath(`${character} is not present in ${label}.`);
        return;
      }
      // TODO(skishore): We may want a try/catch around this call.
      const path = svg.convertCommandsToPath(glyph.path.commands);
      stage.onGetPath(undefined, path);
    });
  },
});

Template.path_stage.helpers({
  alternative: () => Session.get('stages.path.alternative') || '?',
  options: () => [{font: 'arphic/gkai00mp.ttf', label: 'AR PL KaitiM GB'},
                  {font: 'arphic/UKaiCN.ttf', label: 'AR PL UKai'}],
});

Meteor.startup(() => {
  Tracker.autorun(() => {
    const alternative = Session.get('stages.path.alternative');
    if (alternative) {
      Meteor.subscribe('getAllGlyphs', [alternative]);
      const glyph = Glyphs.findOne({character: alternative});
      if (!glyph) {
        stage.onGetPath(`Could not find glyph for ${alternative}.`);
      } else if (!glyph.stages.path) {
        stage.onGetPath(`No available path for ${alternative}.`);
      } else {
        stage.onGetPath(undefined, glyph.stages.path);
      }
    }
  });
});

export {PathStage};
