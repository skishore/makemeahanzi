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
  encoded_character = row['character'].encode('utf16')
  result.append(chr(len(encoded_character)))
  result.append(encoded_character)
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
