import {AbstractStage} from '/client/lib/abstract';
import {assert} from '/lib/base';
import {cjklib} from '/lib/cjklib';
import {fixStrokes} from '/lib/stroke_caps/fixStrokes';
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
    const raw = stroke_extractor.getStrokes(
        glyph.stages.path, glyph.stages.bridges).strokes;
    this.include = {};
    this.original = {corrected: fixStrokes(raw), raw};
    this.original.corrected.map((x) => this.include[x] = true);
    if (glyph.stages.strokes) {
      this.original.corrected.map((x) => this.include[x] = false);
      glyph.stages.strokes.corrected.map((x) => this.include[x] = true);
    }
  }
  getStageOutput() {
    const fn = (_, i) => this.include[this.original.corrected[i]];
    return {
      raw: this.original.raw.filter(fn),
      corrected: this.original.corrected.filter(fn),
    };
  }
  handleEvent(event, template) {
    assert(this.include.hasOwnProperty(template.d));
    this.include[template.d] = !this.include[template.d];
  }
  refreshUI(character, metadata) {
    const strokes = this.original.corrected;
    Session.set('stage.paths',
                getStrokePaths(strokes, this.include, this.colors));
    const data = cjklib.getCharacterData(character);
    const actual = this.getStageOutput().corrected.length;
    const expected = metadata.strokes || data.strokes;
    Session.set('stage.status', [getStatusLine(actual, expected)]);
  }
}

export {StrokesStage};
