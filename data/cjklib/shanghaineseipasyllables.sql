CREATE TABLE ShanghaineseIPASyllables (
  IPA VARCHAR(7) PRIMARY KEY,    -- IPA syllable
  IPAInitial VARCHAR(7),         -- syllable initial in IPA
  IPAFinal VARCHAR(7),           -- syllable final in IPA
  Flags VARCHAR(3),              -- Flags, (V) voiced, (U) unvoiced, (G) glotal
  UNIQUE (IPAInitial, IPAFinal)
);
