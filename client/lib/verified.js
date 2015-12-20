"use strict";

let stage = undefined;

const delay = 0.2;
const width = 128;

const getMedianLength = (median) => {
  let result = 0;
  for (let i = 0; i < median.length - 1; i++) {
    result += Math.sqrt(Point.distance2(median[i], median[i + 1]));
  }
  return result;
}

const getMedianPath = (median) => {
  const result = [];
  for (let point of median) {
    result.push(result.length === 0 ? 'M' : 'L');
    result.push('' + point[0]);
    result.push('' + point[1]);
  }
  return result.join(' ');
}

stages.verified = class VerifiedStage extends stages.AbstractStage {
  constructor(glyph) {
    super('verified');
    this.character = glyph.character;
    this.order = glyph.stages.order;
    this.strokes = glyph.stages.strokes;
    this.lengths = this.order.map((x) => getMedianLength(x.median) + width);
    this.paths = this.order.map((x) => getMedianPath(x.median));

    requestAnimationFrame(this.updateCompletion.bind(this));
    this.completion = 0;
    stage = this;
  }
  getStrokeAnimations(completion) {
    const index = Math.floor(completion);
    const max = Math.min(index, this.strokes.length - 1);
    const partial = Math.max((completion - index - delay)/(1 - delay), 0);
    const result = [];
    for (let i = 0; i <= max; i++) {
      const element = this.order[i];
      const fraction = i < index ? 1 : partial;
      result.push({
        clip: `animation${i}`,
        stroke: this.strokes[element.stroke],
        median: this.paths[i],
        length: this.lengths[i],
        spacing: 2*this.lengths[i],
        advance: (1 - fraction)*this.lengths[i] + width,
      });
    }
    return result;
  }
  getStrokePaths() {
    return this.strokes.map((x) => ({d: x, fill: 'lightgray'}));
  }
  refreshUI() {
    Session.set('stage.paths', this.getStrokePaths());
    Session.set('stage.animations', this.getStrokeAnimations(this.completion));
    Session.set('stage.status',
                [{cls: 'success', message: 'Character analysis complete.'}]);
  }
  updateCompletion() {
    if (Session.get('editor.glyph').character !== this.character ||
        Session.get('stage.type') !== this.type || stage !== this ||
        this.completion >= this.strokes.length) {
      return;
    }
    requestAnimationFrame(this.updateCompletion.bind(this));
    this.completion = Math.min(this.completion + 0.03, this.strokes.length);
    this.refreshUI();
  }
}
