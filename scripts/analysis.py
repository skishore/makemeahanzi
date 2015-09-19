#!/usr/bin/python
import collections

with open('scripts/glyphs') as f:
  glyphs = f.readlines()[0].strip().decode('utf8')
  glyph_set = set(glyphs)
assert len(glyphs) == len(glyph_set) == 6763

Radical = collections.namedtuple(
    'Radical', ['number', 'character', 'definition', 'pinyin', 'strokes'])

with open('scripts/radicals') as f:
  rows = [line.strip().decode('utf8').split('  ') for line in f.readlines()]
  radicals = [Radical(*row) for row in rows]
  radical_map = dict((radical.character, radical) for radical in radicals)
assert len(radicals) == len(radical_map) == 214

Decomposition = collections.namedtuple('Decomposition', [
  'character',
  'strokes',
  'type',
  'part1',
  'strokes1',
  'warning1',
  'part2',
  'strokes2',
  'warning2',
  'cangjie',
  'radical',
])

with open('data/decomposition/data') as f:
  lines = [line for line in f.readlines() if line.startswith('\t')]
  rows = [line.strip().decode('utf8').split('\t') for line in lines]
  decompositions = [Decomposition(*row)  for row in rows if len(row) == 11]
  decomposition_map = dict((decomposition.character, decomposition)
                            for decomposition in decompositions)
assert len(decomposition_map) == 21166

for glyph in glyphs:
  assert glyph in decomposition_map, 'Missing glyph: %s' % (glyph,)
  decomposition = decomposition_map[glyph]
  for part in decomposition.part1 + decomposition.part2:
    if part != '*' and part not in glyph_set:
      print 'Extra glyph needed for %s: %s' % (glyph, part)
