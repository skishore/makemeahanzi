CREATE TABLE PinyinIPAMapping (
  Pinyin VARCHAR(7),                -- Pinyin syllable
  IPA VARCHAR(14),                  -- syllable in IPA
  Feature VARCHAR(14),              -- special feature of mapping
  PRIMARY KEY (Pinyin, IPA),
  UNIQUE (Pinyin, Feature)
);
