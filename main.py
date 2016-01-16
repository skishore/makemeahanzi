#!/usr/bin/python
import json

# Serializes a single median into a binary format.
def encode_median(median):
  result = []
  result.append(chr(len(median)))
  for (x, y) in median:
    result.append(chr(x/4))
    result.append(chr((900 - y)/4))
  return ''.join(result)

# Serializes a character and its medians into a binary format.
def encode(row):
  result = []
  # TODO(skishore): Figure out how to properly decode UTF-8 or -16 in
  # Javascript  and then use one of those encodings here instead of this hack.
  codepoint = ord(row['character'])
  result.append(chr(codepoint & 0xff))
  result.append(chr(codepoint >> 8))
  # Push the medians into the binary representations.
  result.append(chr(len(row['medians'])))
  result.extend(map(encode_median, row['medians']))
  return ''.join(result)

if __name__ == '__main__':
  with open('makemeahanzi.txt') as input, \
       open('medians.bin', 'w') as output:
    result = input.readline()
    while result:
      row = json.loads(result.strip())
      output.write(encode(row))
      result = input.readline()
