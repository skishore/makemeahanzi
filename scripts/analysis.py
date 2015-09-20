#!/usr/bin/python
# -*- coding: utf-8 -*-
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

RADICAL_VARIANTS_TO_SKIP = (u'𠆢', u'𠘨')
SIMPLIFIED_RADICALS_TO_SKIP = (27,)

def in_cjk_block(character):
  if not (len(character) == 1 and 0x4e00 <= ord(character) <= 0x9fff):
    print '%s is U+%s' % (character, hex(ord(character))[2:].upper())
    return False
  return True

with open('scripts/glyphs') as f:
  glyphs = f.readlines()[0].strip().decode('utf8')
  assert(all(in_cjk_block(glyph) for glyph in glyphs))
  glyph_set = set(glyphs)
assert(len(glyphs) == len(glyph_set) == 6763)

ArchRadical = MutableNamedTuple(
    'Radical', ['number', 'character', 'definition', 'pinyin', 'strokes'])

with open('scripts/arch_radicals') as f:
  rows = [line.strip().decode('utf8').split('  ') for line in f.readlines()]
  arch_radicals = [ArchRadical(*row) for row in rows]
  arch_radical_map = dict((radical.character, radical)
                          for radical in arch_radicals)
assert(len(arch_radicals) == len(arch_radical_map) == 214)

Radical = MutableNamedTuple(
  'Radical', ['number', 'character', 'definition', 'pinyin',
              'strokes', 'traditional', 'variants'])

with open('scripts/radicals') as f:
  rows = [line[:-1].decode('utf8').split('\t') for line in f.readlines()[1:]]
  all_radicals = [Radical(*row) for row in rows]
  radicals = []
  for radical in all_radicals:
    if not radicals or radical.number != radicals[-1].number:
      radicals.append(radical)
  radical_map = dict((radical.character, radical)
                          for radical in radicals)
assert(len(radicals) == len(radical_map) == 214)

print 'Homogenizing Arch radicals:'
for radical in arch_radicals:
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
  if radical.variants:
    radical.variants = tuple(sorted(radical.variants.split()))
  else:
    radical.variants = ()
  in_cjk_block(radical.character)
  if radical.traditional is not None:
    in_cjk_block(radical.traditional)
  [in_cjk_block(variant) for variant in radical.variants]
  assert(radical.definition)
  assert(radical.pinyin)

print 'Homogenizing derived radicals:'
for radical in radicals:
  radical.number = int(radical.number)
  radical.strokes = int(radical.strokes)
  radical.traditional = radical.traditional or None
  radical.variants = \
    tuple(radical.variants.split(',')) if radical.variants else ()
  in_cjk_block(radical.character)
  if radical.traditional is not None:
    in_cjk_block(radical.traditional)
  [in_cjk_block(variant) for variant in radical.variants]
  assert(radical.definition)
  assert(radical.pinyin)

for (arch_radical, radical) in zip(arch_radicals, radicals):
  assert(arch_radical.number == radical.number)
  if arch_radical.character != radical.character:
    print 'Different characters for radical %s: %s vs. %s' % (
        arch_radical.number, arch_radical.character, radical.character)
  if arch_radical.definition != radical.definition:
    print 'Different definitions for radical %s: "%s" vs. "%s"' % (
        arch_radical.number, arch_radical.definition, radical.definition)
  if arch_radical.pinyin != radical.pinyin:
    print 'Different pronunciation for radical %s: "%s" vs. "%s"' % (
        arch_radical.number, arch_radical.pinyin, radical.pinyin)
  if arch_radical.traditional != radical.traditional:
    print 'Different variants for radical %s: "%s" vs. "%s"' % (
        arch_radical.number, arch_radical.traditional, radical.traditional)
  if arch_radical.variants != radical.variants:
    print 'Different variants for radical %s: (%s) vs. (%s)' % (
        arch_radical.number,
        ', '.join(variant.encode('utf8') for variant in arch_radical.variants),
        ', '.join(variant.encode('utf8') for variant in radical.variants))

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

print 'Checking decompositions:'
extra_glyphs = set()
for glyph in glyphs:
  assert(glyph in decomposition_map), 'Missing glyph: %s' % (glyph,)
  decomposition = decomposition_map[glyph]
  for part in decomposition.part1 + decomposition.part2:
    if part != '*' and part not in glyph_set:
      if ord(part) > 0xd000:
        assert part not in decomposition_map
        #print 'Got out-of-bounds character for %s: U+%s' % (
        #    glyph, hex(ord(part))[2:].upper())
        continue
      elif ord(part) < 0xff:
        #print 'Got ASCII character in decomposition for %s: %s' % (glyph, part)
        continue
      #print 'Extra glyph needed for %s: %s' % (glyph, part)
      if part not in decomposition_map:
        #print 'Indivisible part for %s: %s' % (glyph, part)
        continue
      if part in extra_glyphs:
        continue
      extra_glyphs.add(part)
      subdecomposition = decomposition_map[part]
      for subpart in subdecomposition.part1 + subdecomposition.part2:
        if subpart != '*' and subpart not in glyph_set:
          #print 'Failed to decompose %s further: %s' % (part, subpart)
          continue
print '%s extra glyphs required for decompositions.' % (len(extra_glyphs),)
