"use strict";

let stage = undefined;

stages.path = class PathStage extends stages.AbstractStage {
  constructor(glyph) {
    super('path');
    this.adjusted = glyph.stages.path;
    this.character = glyph.character;
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
    Session.set('stage.status', d ? [] : [{cls: 'error', message: this.error}]);
  }
}

// We avoid arrow functions in this map so that this is bound to the template.
Template.path_stage.events({
  'click .option': function(event) {
    const label = this.label;
    const character = stage.character;
    assert(character.length === 1);
    Session.set('modal.text', `Loading ${label}...`);
    Session.set('modal.value', 0);
    opentype.load(this.font, (error, font) => {
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
  options: () => [{font: 'arphic/gkai00mp.ttf', label: 'AR PL KaitiM GB'},
                  {font: 'arphic/UKaiCN.ttf', label: 'AR PL UKai'}],
});
