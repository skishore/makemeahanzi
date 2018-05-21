import {AbstractStage} from '/client/lib/abstract';
import {assert} from '/lib/base';
import {cjklib} from '/lib/cjklib';
import {decomposition_util} from '/lib/decomposition_util';
import {Glyphs} from '/lib/glyphs';
import {pinyin_util} from '/lib/pinyin_util';

let stage = undefined;

const etymology_fields = ['hint', 'phonetic', 'semantic']

// Methods for querying and modifying decomposition trees.

const collectComponents = (subtree) => {
  return subtree ? decomposition_util.collectComponents(subtree) : [];
}

const fixSubtreeChildrenLength = (subtree) => {
  const data = decomposition_util.ids_data[subtree.value];
  assert(data, `Invalid ideograph description character: ${subtree.value}`);
  subtree.children.length = data.arity;
  for (let i = 0; i < subtree.children.length; i++) {
    subtree.children[i] =
        subtree.children[i] || {type: 'character', value: '?'};
    subtree.children[i].path = subtree.path.concat([i]);
  }
}

const setSubtreeType = (subtree, type) => {
  if (subtree.type === type) {
    return;
  }
  if (type === 'character') {
    subtree.value = '?';
    delete subtree.children;
  } else if (type === 'compound') {
    subtree.value = decomposition_util.ideograph_description_characters[0];
    subtree.children = [];
    fixSubtreeChildrenLength(subtree);
  } else {
    assert(false, `Unexpected subtree type: ${type}`);
  }
  subtree.type = type;
}

// Methods for handling updates to various non-decomposition analysis fields.

const updateCharacterValue = (target, text, path) => {
  const subtree = decomposition_util.getSubtree(stage.tree, path);
  if (text === subtree.value || subtree.type !== 'character') {
    return;
  }
  const value = text.length === 1 ? text : '?';
  if (value === subtree.value) {
    target.text(value);
  } else {
    subtree.value = text.length === 1 ? text : '?';
    stage.forceRefresh();
  }
}

const updateEtymology = (target, text, type) => {
  let value = text && text !== '?' ? text : undefined;
  const expansion = ' aptp';
  if (type === 'hint' && value && value.endsWith(expansion)) {
    const suffix = 'also provides the pronunciation'
    value = `${value.substr(0, value.length - expansion.length)} ${suffix}`;
  }
  if (value === stage.etymology[type]) {
    target.text(value || '?');
  } else {
    stage.etymology[type] = value;
    stage.forceRefresh();
  }
}

const updateRadicalValue = (target, text) => {
  const value = text && text !== '?' ? text : undefined;
  if (value === stage.radical) {
    target.text(value || '?');
  } else {
    stage.radical = value;
    stage.forceRefresh();
  }
}

// Methods for initializing different fields of the analysis.

const initializeDecompositionTree = (analysis, character) => {
  const data = cjklib.getCharacterData(character);
  return decomposition_util.convertDecompositionToTree(
      analysis.decomposition || data.decomposition);
}

const initializeRadical = (character, components) => {
  if (cjklib.radicals.radical_to_index_map.hasOwnProperty(character)) {
    return character;
  }
  const data = cjklib.getCharacterData(character);
  if (data.kangxi_index) {
    const index = data.kangxi_index[0];
    const radicals = cjklib.radicals.index_to_radical_map[index];
    const included = radicals.filter((x) => components.indexOf(x) >= 0);
    return included.length === 1 ? included[0] : radicals.join('');
  }
  return undefined;
}

const initializeEtymology = (glyph, components) => {
  const data = cjklib.getCharacterData(glyph.character);
  const target = pinyin_util.dropTones(
      glyph.metadata.pinyin || data.pinyin || '');
  const phonetic_match = (component) => {
    const component_data = cjklib.getCharacterData(component);
    const attempt = pinyin_util.dropTones(component_data.pinyin || '');
    return attempt && attempt === target;
  }
  const phonetic = components.filter(phonetic_match);
  if (phonetic.length === 1) {
    const result = {type: 'pictophonetic', phonetic: phonetic[0]};
    const semantic = components.filter((x) => !phonetic_match(x));
    if (semantic.length === 1) {
      result.semantic = semantic[0];
    }
    return result;
  }
  return {type: 'ideographic'};
}

// Methods for automatically inferring a phonetic-semantic decomposition.

const doubleAlphabeticCharacters = (pinyin) => {
  const numbered = pinyin_util.tonePinyinToNumberedPinyin(pinyin);
  return Array.from(numbered).map((x) => /[a-z]/.test(x) ? x + x : x).join('');
}

const guessPhoneticAndSemanticComponents = (glyph, components) => {
  const data = cjklib.getCharacterData(glyph.character);
  const target = doubleAlphabeticCharacters(
      glyph.metadata.pinyin || data.pinyin || '');
  const distance = (component) => {
    const component_data = cjklib.getCharacterData(component);
    const attempt = doubleAlphabeticCharacters(component_data.pinyin || '');
    return s.levenshtein(attempt, target);
  }
  const pairs = components.map((x) => [x, distance(x)]);
  const sorted = pairs.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  const result = {};
  if (sorted.length > 0) {
    result.phonetic = sorted[0];
    if (sorted.length === 2) {
      result.semantic = sorted[1];
    }
  }
  return result;
}

class AnalysisStage extends AbstractStage {
  constructor(glyph) {
    super('analysis');
    this.strokes = glyph.stages.strokes.corrected;
    const analysis = glyph.stages.analysis || {};
    this.tree = initializeDecompositionTree(analysis, glyph.character);
    const components = collectComponents(this.tree);
    this.radical = analysis.radical ||
                   initializeRadical(glyph.character, components);
    this.etymology = analysis.etymology ||
                     initializeEtymology(glyph, components);
    this.simplified = cjklib.getCharacterData(glyph.character).simplified;
    stage = this;
    updateStatus();
  }
  clearLaterStages(output1, output2) {
    return output1.decomposition !== output2.decomposition;
  }
  getStageOutput() {
    return {
      decomposition: decomposition_util.convertTreeToDecomposition(this.tree),
      etymology: _.extend({}, this.etymology),
      radical: this.radical,
    }
  }
  refreshUI() {
    const to_path = (x) => ({d: x, fill: 'gray', stroke: 'gray'});
    Session.set('stage.paths', this.strokes.map(to_path));
    Session.set('stages.analysis.tree', this.tree);
    Session.set('stages.analysis.radical', this.radical);
    Session.set('stages.analysis.etymology', this.etymology);
    Session.set('stages.analysis.simplified', this.simplified);
  }
}

Template.analysis_stage.events({
  'blur .value': function(event) {
    // This line is not needed for correctness, so we ignore any errors in it.
    try { window.getSelection().removeAllRanges(); } catch (e) { }
    const target = $(event.target);
    const field = target.attr('data-field');
    const text = target.text();
    if (field === 'character') {
      updateCharacterValue(target, text, this.path);
    } else if (field === 'radical') {
      updateRadicalValue(target, text);
    } else if (etymology_fields.indexOf(field) >= 0) {
      updateEtymology(target, text, field);
    } else {
      assert(false, `Unexpected editable field: ${field}`);
    }
  },
  'change .compound-type': function(event) {
    const type = $(event.target).val();
    const subtree = decomposition_util.getSubtree(stage.tree, this.path);
    if (type === subtree.value || subtree.type != 'compound') {
      return;
    }
    subtree.value = type;
    fixSubtreeChildrenLength(subtree);
    stage.forceRefresh();
  },
  'change .etymology-type': function(event) {
    const type = $(event.target).val();
    etymology_fields.map(
        (x) => { if (x !== 'hint') delete stage.etymology[x]; });
    if ((type === 'pictophonetic') !==
        (stage.etymology.type === 'pictophonetic')) {
      delete stage.etymology.hint;
    }
    stage.etymology.type = type;
    if (type === 'pictophonetic') {
      _.extend(stage.etymology, guessPhoneticAndSemanticComponents(
          Session.get('editor.glyph'), collectComponents(stage.tree)));
    }
    stage.forceRefresh();
  },
  'change .subtree-type': function(event) {
    const type = $(event.target).val();
    const subtree = decomposition_util.getSubtree(stage.tree, this.path);
    setSubtreeType(subtree, type);
    stage.forceRefresh();
  },
});

Template.analysis_stage.helpers({
  decomposition_data: () => {
    return Session.get('stages.analysis.tree');
  },
  etymology_data: () => {
    const result = Session.get('stages.analysis.etymology') || {};
    result.hint = result.hint || '?';
    if (result.type === 'pictophonetic') {
      result.phonetic = result.phonetic || '?';
      result.semantic = result.semantic || '?';
    }
    return result;
  },
  radical: () => {
    return Session.get('stages.analysis.radical') || '?';
  },
});

Template.tree.helpers({
  compounds: (value) => {
    return decomposition_util.ideograph_description_characters.map( (x) => ({
      compound: x,
      label: `${x} - ${decomposition_util.ids_data[x].label}`,
      value: value,
    }));
  },
  details: (character) => {
    const glyph = Glyphs.get(character);
    const data = cjklib.getCharacterData(character);
    let definition = glyph.metadata.definition || data.definition;
    let pinyin = glyph.metadata.pinyin || data.pinyin;
    let radical = '';
    if (cjklib.radicals.radical_to_index_map.hasOwnProperty(character)) {
      const index = cjklib.radicals.radical_to_index_map[character];
      const primary = cjklib.radicals.primary_radical[index];
      const variant = primary !== character;
      radical = `; ${variant ? 'variant of ' : ''}` +
                `Kangxi radical ${index} ${variant ? primary : ''}`;
      if (variant && Glyphs.get(primary)) {
        const glyph = Glyphs.get(primary);
        const data = cjklib.getCharacterData(primary);
        definition = definition || glyph.definition || data.definition;
        pinyin = pinyin || glyph.pinyin || data.pinyin;
      }
    }
    definition = definition || '(unknown)';
    return `${pinyin ? pinyin + ' - ' : ''}${definition}${radical}`;
  },
});

const traditionalEtymologyHack = () => {
  // Only compute the traditional etymology based on simplified once, and only
  // if this character does not already have an etymology computed.
  if (!stage || !stage.simplified ||
      stage.inferred_etymology_from_simplified_form) {
    return;
  }
  const glyph = Session.get('editor.glyph');
  const simplified = Glyphs.findOne({character: stage.simplified});
  if (!glyph || !simplified) {
    return;
  }
  stage.inferred_etymology_from_simplified_form = true;
  if ((glyph.stages.analysis && glyph.stages.analysis.etymology &&
       glyph.stages.analysis.etymology.hint) ||
      !(simplified.stages.analysis && simplified.stages.analysis.etymology &&
        simplified.stages.analysis.etymology.hint)) {
    return;
  }
  // Try to pull components for the simplified character up to components for
  // the traditional character.
  const mapping = {};
  const analysis = simplified.stages.analysis;
  const decomposition =
      decomposition_util.convertTreeToDecomposition(stage.tree);
  if (decomposition.length === analysis.decomposition.length &&
      decomposition[0] === analysis.decomposition[0]) {
    for (let i = 0; i < decomposition.length; i++) {
      mapping[analysis.decomposition[i]] = decomposition[i];
    }
  } else {
    return;
  }
  // Pull the actual etymology.
  stage.etymology = {};
  for (let key of _.keys(analysis.etymology)) {
    const value = analysis.etymology[key];
    stage.etymology[key] = key === 'type' ? value : value.applyMapping(mapping);
  }
  stage.forceRefresh();
}

const updateStatus = () => {
  const components = collectComponents(Session.get('stages.analysis.tree'));
  if (Session.get('stages.analysis.simplified')) {
    components.push(Session.get('stages.analysis.simplified'));
  }
  const radical = Session.get('stages.analysis.radical');
  const missing = components.filter((x) => {
    const glyph = Glyphs.findOne({character: x});
    return !glyph || !glyph.stages.verified;
  });
  const log = [];
  if (missing.length === 0) {
    log.push({cls: 'success', message: 'All components ready.'});
    Meteor.setTimeout(traditionalEtymologyHack, 0);
  } else {
    const error = `Incomplete components: ${missing.join(' ')}`;
    log.push({cls: 'error', message: error});
  }
  if (!radical || radical.length === 0) {
    log.push({cls: 'error', message: 'No radical selected.'});
  } else if (radical.length > 1) {
    log.push({cls: 'error', message: 'Multiple radicals selected.'});
  } else if (components.indexOf(radical) >= 0) {
    log.push({cls: 'success',
              message: `Radical ${radical} found in decomposition.`});
  }
  const nonradicals = (Array.from(radical || '')).filter(
      (x) => !cjklib.radicals.radical_to_index_map.hasOwnProperty(x));
  if (nonradicals.length > 0) {
    log.push({cls: 'error', message: 'Radical field includes non-radicals: ' +
                                     nonradicals.join(' ')});
  }
  if (Session.get('stage.type') === 'analysis') {
    Session.set('stage.status', log);
  }
}

// We need to add the setTimeout here because client/lib is loaded before lib.
// TODO(skishore): Find a better way to handle this load-order issue.
Meteor.startup(() => Meteor.setTimeout(() => {
  Tracker.autorun(updateStatus);
  cjklib.promise.then(() => Tracker.autorun(() => {
    const components = collectComponents(Session.get('stages.analysis.tree'));
    if (Session.get('stages.analysis.simplified')) {
      components.push(Session.get('stages.analysis.simplified'));
    }
    for (let component of [].concat(components)) {
      if (cjklib.radicals.radical_to_index_map.hasOwnProperty(component)) {
        const index = cjklib.radicals.radical_to_index_map[component];
        const primary = cjklib.radicals.primary_radical[index]
        if (primary !== component) {
          components.push(primary);
        }
      }
    }
    Meteor.subscribe('getAllGlyphs', components);
  })).catch(console.error.bind(console));
}, 0));

export {AnalysisStage};
