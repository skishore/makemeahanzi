"use strict";

stages.path = class PathStage extends stages.AbstractStage {
  constructor(glyph) {
    super();
    Session.set('stage.type', 'path');
    Session.set('stage.instructions',
                'Choose a source for glyph path data for this character:');
  }
  refresh(glyph) {
    const d = glyph.stages.path;
    Session.set('stage.paths', [{d: d, fill: 'gray', stroke: 'gray'}]);
  }
}
