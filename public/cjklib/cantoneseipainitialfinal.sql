CREATE TABLE CantoneseIPAInitialFinal (
  IPA VARCHAR(14) PRIMARY KEY,      -- syllable in IPA
  IPAInitial VARCHAR(7),            -- syllable initial in IPA
  IPAFinal VARCHAR(7),              -- syllable final in IPA
  UnreleasedFinal VARCHAR(1),       -- 'U' if syllable has a unreleased stop
                                    --   final consonant
  VowelLength VARCHAR(1),           -- 'S' if the syllable's vowel is short,
                                    --   'L' if it is long
  UNIQUE (IPAInitial, IPAFinal)
);
