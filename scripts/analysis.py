#!/usr/bin/python
def MutableNamedTuple(name, fields):
  def tostr(value):
    if type(value) == unicode:
      return "'%s'" % (value.encode('utf8'))
    return repr(value)
  class TemporaryClass(object):
    __name__ = name
    def __init__(self, *args):
      assert(len(args) == len(fields))
      for (key, value) in zip(fields, args):
        self.__dict__[key] = value
    def __str__(self):
      return '%s(%s)' % (name, ', '.join(
          tostr(self.__dict__[key]) for key in fields))
  return TemporaryClass

with open('scripts/glyphs') as f:
  glyphs = f.readlines()[0].strip().decode('utf8')
  glyph_set = set(glyphs)
assert(len(glyphs) == len(glyph_set) == 6763)

Radical = MutableNamedTuple(
    'Radical', ['number', 'character', 'definition', 'pinyin', 'strokes'])

with open('scripts/radicals') as f:
  rows = [line.strip().decode('utf8').split('  ') for line in f.readlines()]
  radicals = [Radical(*row) for row in rows]
  radical_map = dict((radical.character, radical) for radical in radicals)
assert(len(radicals) == len(radical_map) == 214)

WikiRadical = MutableNamedTuple(
    'WikiRadical', ['number', 'character', 'strokes', 'pinyin',
                    'unused1', 'unused2', 'unused3', 'definition',
                    'frequency', 'simplified', 'examples'])

with open('scripts/wiki_radicals') as f:
  rows = [line.strip().decode('utf8').split('\t') for line in f.readlines()[2:]]
  wiki_radicals = [WikiRadical(*row) for row in rows]
  wiki_radical_map = dict((radical.character, radical)
                          for radical in wiki_radicals)
assert(len(wiki_radicals) == len(wiki_radical_map) == 214)

for radical in radicals:
  radical.number = int(radical.number)
  radical.number = int(radical.number)
  radical.variants = ''
  if ' ' in radical.strokes:
    index = radical.strokes.find(' ')
    radical.variants = radical.strokes[index + 1:]
    radical.strokes = radical.strokes[:index]
  radical.strokes = int(radical.strokes)
  if radical.variants.startswith('('):
    assert(radical.variants.endswith(')'))
    radical.traditional = radical.variants[1:-1]
    radical.variants = ''
  else:
    radical.traditional = None
  radical.variants = radical.variants.split() if radical.variants else []
  assert(len(radical.character) == 1)
  assert(radical.traditional is None or len(radical.traditional) == 1)
  assert(all(len(variant) == 1 for variant in radical.variants))
  assert(radical.definition)
  assert(radical.pinyin)

for (radical, wiki_radical) in zip(radicals, wiki_radicals):
  print radical
  print wiki_radical
  assert(radical.number == wiki_radical.number)
  if radical.character != wiki_radical.character:
    print 'Different characters for radical %s: %s vs. %s' % (
        radical.number, radical.character, wiki_radical.character)
  if radical.definition != wiki_radical.definition:
    print 'Different definitions for radical %s: "%s" vs. "%s"' % (
        radical.number, radical.definition, wiki_radical.definition)

Decomposition = MutableNamedTuple(
  'Decomposition', ['character', 'strokes', 'type', 'part1', 'strokes1',
                    'warning1', 'part2', 'strokes2', 'warning2',
                    'cangjie', 'radical'])

with open('data/decomposition/data') as f:
  lines = [line for line in f.readlines() if line.startswith('\t')]
  rows = [line.strip().decode('utf8').split('\t') for line in lines]
  decompositions = [Decomposition(*row)  for row in rows if len(row) == 11]
  decomposition_map = dict((decomposition.character, decomposition)
                            for decomposition in decompositions)
assert(len(decomposition_map) == 21166)

for glyph in glyphs:
  assert(glyph in decomposition_map), 'Missing glyph: %s' % (glyph,)
  decomposition = decomposition_map[glyph]
  for part in decomposition.part1 + decomposition.part2:
    if part != '*' and part not in glyph_set:
      #print 'Extra glyph needed for %s: %s' % (glyph, part)
      continue
