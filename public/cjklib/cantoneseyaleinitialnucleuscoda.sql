CREATE TABLE CantoneseYaleInitialNucleusCoda (
  CantoneseYale VARCHAR(6) PRIMARY KEY,    -- syllable in Cantonese Yale
  CantoneseYaleInitial VARCHAR(2),         -- syllable initial in Cantonese Yale
  CantoneseYaleNucleus VARCHAR(3),         -- syllable nucleus in Cantonese Yale
  CantoneseYaleCoda VARCHAR(2),            -- syllable coda in Cantonese Yale
  UNIQUE (CantoneseYaleInitial, CantoneseYaleNucleus, CantoneseYaleCoda)
);
