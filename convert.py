#!/usr/bin/python
'''
Converts a font from one format to another. The input and output formats are
inferred based on file names. This script is a thin wrapper around the fontforge
Python library, which it depends on.
'''

import fontforge
import sys

if __name__ == '__main__':
  assert len(sys.argv) == 3, 'Usage: ./convert.py <input> <output>'
  font = fontforge.open(sys.argv[1])
  font.generate(sys.argv[2])
