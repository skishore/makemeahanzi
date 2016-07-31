import {assert} from '/lib/base';

const vowel_to_tone =
    {0: "aeiouü", 1: "āēīōūǖ", 2: "áéíóúǘ", 3: "ǎěǐǒǔǚ", 4: "àèìòùǜ"};

const tokenSet = (tokens) => {
  const result = {};
  tokens.split(' ').map((x) => result[x] = true);
  return result;
}

const consonants = tokenSet('b p m f d t n l g k h j q x zh ch sh r z c s y w');
const vowels = tokenSet('a ai an ang ao e ei en eng er i ia ian iang iao ie ' +
                        'in ing io iong iu o ong ou u ua uai uan uang ue ui ' +
                        'un uo v van vn');
const two_syllables = tokenSet('ia ian iang iao ie io iong iu ua uai uan ' +
                               'uang ue ui uo van');

const pinyin_util = {};

pinyin_util.dropTones = (pinyin, append_number) => {
  for (let i = 0; i < pinyin.length; i++) {
    for (let option = 1; option <= 4; option++) {
      const index = vowel_to_tone[option].indexOf(pinyin[i]);
      if (index >= 0) {
        const toneless = 'aeiouv'[index];
        pinyin = pinyin.substr(0, i) + toneless + pinyin.substr(i + 1);
        if (append_number) {
          return `${pinyin}${option}`;
        }
      }
    }
  }
  return pinyin;
}

pinyin_util.numberedPinyinToTonePinyin = (numbered) => {
  assert(numbered && numbered === numbered.toLowerCase());
  let tone = 0;
  if ('01234'.indexOf(numbered[numbered.length - 1]) >= 0) {
    tone = parseInt(numbered[numbered.length - 1], 10);
    numbered = numbered.substr(0, numbered.length - 1);
  }
  for (let i = 0; i < numbered.length; i++) {
    for (let option = 1; option <= 4; option++) {
      const index = vowel_to_tone[option].indexOf(numbered[i]);
      if (index >= 0) {
        tone = option;
        const toneless = 'aeiouv'[index];
        numbered = numbered.substr(0, i) + toneless + numbered.substr(i + 1);
      }
    }
  }
  let consonant = '';
  for (let i = 1; i < numbered.length; i++) {
    const candidate = numbered.substr(0, i);
    if (consonants[candidate]) {
      consonant = candidate;
    } else {
      break;
    }
  }
  let vowel = numbered.substr(consonant.length);
  assert((!consonant || consonants[consonant]) && vowels[vowel]);
  if (two_syllables[vowel]) {
    const index = 'aeiouv'.indexOf(vowel[1]);
    vowel = vowel[0] + vowel_to_tone[tone][index] + vowel.substr(2);
  } else {
    const index = 'aeiouv'.indexOf(vowel[0]);
    assert(index >= 0);
    vowel = vowel_to_tone[tone][index] + vowel.substr(1);
  }
  return consonant + vowel.replace('v', 'ü');
}

pinyin_util.tonePinyinToNumberedPinyin = (tone) => {
  return pinyin_util.dropTones(tone, true /* append_number */);
}

export {pinyin_util};
