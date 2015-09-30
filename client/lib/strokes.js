"use strict";

const getStatusLine = (actual, expected) => {
  const actual_text = `Selected ${actual} stroke${actual === 1 ? '' : 's'}`;
  if (!expected) {
    return {cls: 'error', message: `${actual_text}. True number unknown.`};
  } else if (actual !== expected) {
    return {cls: 'error', message: `${actual_text}, but need ${expected}.`};
  }
  return {cls: 'success', message: `${actual_text}.`};
}

const getStrokePaths = (strokes, include, colors) => {
  const result = [];
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    const color = include[stroke] ? colors[i % colors.length] : 'gray';
    result.push({cls: 'selectable', d: stroke, fill: color, stroke: 'black'});
  }
  return result;
}

stages.strokes = class StrokesStage extends stages.AbstractStage {
  constructor(glyph) {
    super();
    Session.set('stage.type', 'strokes');
    Session.set('stage.instructions',
                'Select paths to include in the glyph by clicking on them. ' +
                'The final number of paths must agree with the stroke count ' +
                'in the character metadata.');
    const include = this.include = {};
    this.strokes = stroke_extractor.getStrokes(glyph).strokes;
    this.strokes.map((stroke) => include[stroke] = true);
    if (glyph.stages.strokes && glyph.stages.strokes.length > 0 &&
        glyph.stages.strokes.filter((x) => !include[x]).length === 0) {
      this.strokes.map((stroke) => include[stroke] = false);
      glyph.stages.strokes.map((stroke) => include[stroke] = true);
    }
  }
  handleEvent(glyph, event, template) {
    assert(this.include.hasOwnProperty(template.d));
    this.include[template.d] = !this.include[template.d];
    glyph.stages.strokes = this.strokes.filter((x) => this.include[x]);
    Session.set('editor.glyph', glyph);
  }
  refresh(glyph) {
    Session.set('stage.paths',
                getStrokePaths(this.strokes, this.include, this.colors));
    const data = cjklib.getCharacterData(glyph.character);
    const actual = glyph.stages.strokes.length;
    const expected = glyph.metadata.strokes || data.strokes;
    Session.set('stage.status', [getStatusLine(actual, expected)]);
  }
}
