"use strict";

let stage = undefined;

stages.analysis = class AnalysisStage extends stages.AbstractStage {
  constructor(glyph) {
    super('analysis');
    this.adjusted = glyph.stages.path;
    const data = cjklib.getCharacterData(glyph.character);
    Session.set('stages.analysis.decomposition', data.decomposition);
    if (data.kangxi_index) {
      const index = data.kangxi_index[0];
      Session.set('stages.analysis.radical',
                  cjklib.radicals.index_to_radical_map[index].join(' '));
    } else {
      Session.set('stages.analysis.radical', undefined);
    }
    stage = this;
  }
  refreshUI() {
    const d = this.adjusted;
    Session.set('stage.paths', [{d: d, fill: 'gray', stroke: 'gray'}]);
  }
}

Template.analysis_stage.helpers({
  decomposition: () => {
    return Session.get('stages.analysis.decomposition') || '(unknown)';
  },
  radical: () => {
    return Session.get('stages.analysis.radical') || '(unknown)';
  },
});
