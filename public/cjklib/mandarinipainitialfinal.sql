CREATE TABLE MandarinIPAInitialFinal (
  IPA VARCHAR(14) PRIMARY KEY,      -- syllable in IPA
  IPAInitial VARCHAR(7),            -- syllable initial in IPA
  IPAFinal VARCHAR(7),              -- syllable final in IPA
  UNIQUE (IPAInitial, IPAFinal)
);
