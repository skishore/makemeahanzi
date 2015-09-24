CREATE TABLE JyutpingIPAMapping (
  Jyutping VARCHAR(7) PRIMARY KEY,  -- Jyutping syllable
  IPA VARCHAR(14) UNIQUE            -- syllable in IPA
);
