CREATE TABLE WadeGilesPinyinMapping (
  WadeGiles VARCHAR(8) PRIMARY KEY,      -- Wade-Giles syllable
  Pinyin VARCHAR(7),                -- Pinyin syllable
  PinyinIdx INTEGER                 -- Index of Pinyin syllable, values > 0 in
                                    --  case of ambiguity, 0 for the default
                                    --  syllable
);
