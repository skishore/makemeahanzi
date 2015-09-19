#!/usr/bin/python
with open('scripts/glyphs') as f:
  glyphs = f.readlines()[0].strip().decode('utf8')
assert len(glyphs) == 6763
