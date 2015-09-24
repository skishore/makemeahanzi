CREATE TABLE PinyinGRMapping (
  Pinyin VARCHAR(7) PRIMARY KEY,    -- Pinyin syllable
  GR VARCHAR(8) UNIQUE              -- GR syllable
);
