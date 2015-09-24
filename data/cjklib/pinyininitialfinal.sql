CREATE TABLE PinyinInitialFinal (
  Pinyin VARCHAR(7) PRIMARY KEY,    -- syllable in Pinyin
  PinyinInitial VARCHAR(2),         -- syllable initial in "Pinyin equivalent"
  PinyinFinal VARCHAR(5),           -- syllable final in "Pinyin equivalent"
  UNIQUE (PinyinInitial, PinyinFinal)
);
