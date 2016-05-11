"use strict";

stages.verified = class VerifiedStage extends stages.AbstractStage {
  constructor(glyph) {
    super('verified');
    const strokes = glyph.stages.order.map(
        (x) => glyph.stages.strokes[x.stroke]);
    const medians = glyph.stages.order.map((x) => x.median);
    const options = {delay: 0.3, speed: 0.02};
    this.data = getAnimationData(strokes, medians, options);
  }
  refreshUI() {
    Session.set('stage.status',
                [{cls: 'success', message: 'Character analysis complete.'}]);
    Session.set('stages.verified.data', this.data);
  }
}

Template.verified_stage.helpers({
  data: () => Session.get('stages.verified.data'),
});
