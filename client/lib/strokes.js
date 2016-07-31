import {AbstractStage} from '/client/lib/abstract';
import {assert} from '/lib/base';
import {cjklib} from '/lib/cjklib';
import {stroke_extractor} from '/lib/stroke_extractor';

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

class StrokesStage extends AbstractStage {
  constructor(glyph) {
    super('strokes');
    const include = this.include = {};
    this.original = stroke_extractor.getStrokes(
        glyph.stages.path, glyph.stages.bridges).strokes;
    this.original.map((x) => this.include[x] = true);
    if (glyph.stages.strokes &&
        glyph.stages.strokes.filter((x) => !include[x]).length === 0) {
      this.original.map((x) => this.include[x] = false);
      glyph.stages.strokes.map((x) => include[x] = true);
    }
    this.adjusted = this.original.filter((x) => this.include[x]);
  }
  handleEvent(event, template) {
    assert(this.include.hasOwnProperty(template.d));
    this.include[template.d] = !this.include[template.d];
    this.adjusted = this.original.filter((x) => this.include[x]);
  }
  refreshUI(character, metadata) {
    Session.set('stage.paths',
                getStrokePaths(this.original, this.include, this.colors));
    const data = cjklib.getCharacterData(character);
    const actual = this.adjusted.length;
    const expected = metadata.strokes || data.strokes;
    Session.set('stage.status', [getStatusLine(actual, expected)]);
  }
}

export {StrokesStage};
