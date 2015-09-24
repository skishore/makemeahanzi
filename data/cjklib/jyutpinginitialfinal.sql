CREATE TABLE JyutpingInitialFinal (
  Jyutping VARCHAR(7) PRIMARY KEY,  -- syllable in Jyutping
  JyutpingInitial VARCHAR(2),       -- syllable initial in Jyutping
  JyutpingFinal VARCHAR(5),         -- syllable final in Jyutping
  UNIQUE (JyutpingInitial, JyutpingFinal)
);
