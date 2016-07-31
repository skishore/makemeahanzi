import {assert} from '/lib/base';
import {cjklib} from '/lib/cjklib';

const defaultGlyph = (character) => {
  if (!character) return;
  assert(character.length === 1);
  const data = cjklib.getCharacterData(character);
  const result = {
    character: character,
    codepoint: character.codePointAt(0),
    metadata: {
      frequency: data.frequency,
      kangxi_index: data.kangxi_index,
    },
    stages: {},
    simplified: data.simplified,
    traditional: data.traditional,
  }
  if (data.simplified) {
    const glyph = Glyphs.get(data.simplified);
    const base = cjklib.getCharacterData(data.simplified);
    if (glyph.stages.verified) {
      const metadata = glyph.metadata;
      result.metadata.definition = metadata.definition || base.definition;
      result.metadata.pinyin = metadata.pinyin || base.pinyin;
    }
  }
  return result;
}

const Glyphs = new Mongo.Collection('glyphs');
const Progress = new Mongo.Collection('progress');

Glyphs.clearDependencies = (character) => {
  const stack = [character];
  const visited = {};
  visited[character] = true;
  while (stack.length > 0) {
    const current = stack.pop();
    const dependencies = Glyphs.find({
      'stages.analysis.decomposition': {$regex: `.*${current}.*`},
      'stages.order': {$ne: null},
    }, {character: 1}).fetch();
    dependencies.map((x) => x.character).filter((x) => !visited[x]).map((x) => {
      stack.push(x);
      visited[x] = true;
    });
  }
  delete visited[character];
  Glyphs.update({character: {$in: Object.keys(visited)}},
                {$set: {'stages.order': null, 'stages.verified': null}},
                {multi: true});
}

Glyphs.get = (character) =>
    Glyphs.findOne({character: character}) || defaultGlyph(character);

Glyphs.getAll = (characters) => Glyphs.find({character: {$in: characters}});

Glyphs.getNext = (glyph, clause) => {
  clause = clause || {};
  const codepoint = glyph ? glyph.codepoint : undefined;
  const condition = _.extend({codepoint: {$gt: codepoint}}, clause);
  const next = Glyphs.findOne(condition, {sort: {codepoint: 1}});
  return next ? next : Glyphs.findOne(clause, {sort: {codepoint: 1}});
}

Glyphs.getNextUnverified = (glyph) => {
  return Glyphs.getNext(glyph, {'stages.verified': null});
}

Glyphs.getNextVerified = (glyph) => {
  return Glyphs.getNext(glyph, {'stages.verified': {$ne: null}});
}

Glyphs.getPrevious = (glyph, clause) => {
  clause = clause || {};
  const codepoint = glyph ? glyph.codepoint : undefined;
  const condition = _.extend({codepoint: {$lt: codepoint}}, clause);
  const previous = Glyphs.findOne(condition, {sort: {codepoint: -1}});
  return previous ? previous : Glyphs.findOne(clause, {sort: {codepoint: -1}});
}

Glyphs.getPreviousUnverified = (glyph) => {
  return Glyphs.getPrevious(glyph, {'stages.verified': null});
}

Glyphs.getPreviousVerified = (glyph) => {
  return Glyphs.getPrevious(glyph, {'stages.verified': {$ne: null}});
}

Glyphs.loadAll = (characters) => {
  for (let character of characters) {
    const glyph = Glyphs.get(character);
    if (!glyph.stages.verified) {
      Glyphs.upsert({character: glyph.character}, glyph);
    }
  }
  Progress.refresh();
}

Glyphs.save = (glyph) => {
  check(glyph.character, String);
  assert(glyph.character.length === 1);
  const current = Glyphs.get(glyph.character);
  if (current && current.stages.verified && !glyph.stages.verified) {
    Glyphs.clearDependencies(glyph.character);
  }
  Glyphs.syncDefinitionAndPinyin(glyph);
  if (glyph.stages.path && !glyph.stages.path.sentinel) {
    Glyphs.upsert({character: glyph.character}, glyph);
  } else {
    Glyphs.remove({character: glyph.character});
  }
  Progress.refresh();
}

Glyphs.syncDefinitionAndPinyin = (glyph) => {
  const data = cjklib.getCharacterData(glyph.character);
  const base = cjklib.getCharacterData(data.simplified || glyph.character);
  const targets = [base.character].concat(base.traditional);
  if (targets.length === 1 || '干么着复'.indexOf(targets[0]) >= 0) {
    return;
  }
  const definition = glyph.metadata.definition || data.definition;
  const pinyin = glyph.metadata.pinyin || data.pinyin;
  Glyphs.update({character: {$in: targets}}, {$set: {
    'metadata.definition': definition,
    'metadata.pinyin': pinyin,
  }}, {multi: true});
}

Progress.refresh = () => {
  const total = Glyphs.find().count();
  const complete = Glyphs.find({'stages.verified': {$ne: null}}).count();
  Progress.upsert({}, {total: total, complete: complete, backup: false});
}

if (Meteor.isServer) {
  // Construct indices on the Glyphs table.
  Glyphs._ensureIndex({character: 1}, {unique: true});
  Glyphs._ensureIndex({codepoint: 1}, {unique: true});
  Glyphs._ensureIndex({'stages.verified': 1});

  // Refresh the Progress counter.
  Progress.refresh();

  // Register the methods above so they are available to the client.
  const methods = {};
  const method_names = [
      'get', 'getNext', 'getNextUnverified', 'getNextVerified',
      'getPrevious', 'getPreviousUnverified', 'getPreviousVerified', 'save'];
  method_names.map((name) => methods[`${name}Glyph`] = Glyphs[name]);
  methods.loadAllGlyphs = Glyphs.loadAll;
  methods.saveGlyphs = (glyphs) => glyphs.map(Glyphs.save);
  Meteor.methods(methods);

  // Publish accessors that will get all glyphs in a list and get the progress.
  Meteor.publish('getAllGlyphs', Glyphs.getAll);
  Meteor.publish('getProgress', Progress.find.bind(Progress));
}

export {Glyphs, Progress};
