"use strict";

stages.path = class PathStage extends stages.AbstractStage {
  constructor(glyph) {
    super('path');
  }
  refresh(glyph) {
    const d = glyph.stages.path;
    Session.set('stage.paths', [{d: d, fill: 'gray', stroke: 'gray'}]);
    Session.set('stage.status',
                d ? [] : [{cls: 'error', message: 'No path data.'}]);
  }
}

Template.path_stage.helpers({
  options: () => [{label: 'gkai'}, {label: 'UKaiCN'}],
});
