import json

normalization = 16

def normalize(median):
  return map(lambda x: (x[0]/normalization, x[1]/normalization), median)

characters = []
for line in open('makemeahanzi.txt').readlines():
  character = json.loads(line.strip())
  characters.append([character['character'],
                     map(normalize, character['medians'])])
open('medians.js', 'w').write(
    'medians = %s;' % (json.dumps(characters).replace(' ', ''),))
