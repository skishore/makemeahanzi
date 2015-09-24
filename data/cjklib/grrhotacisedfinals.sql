CREATE TABLE GRRhotacisedFinals (
  GRFinal VARCHAR(7) PRIMARY KEY,       -- GR non-rhotacised final
  GRFinal_T1 VARCHAR(7),                -- GR rhotacised final in first tone
  GRFinal_T2 VARCHAR(7),                -- GR rhotacised final in second tone
  GRFinal_T3 VARCHAR(7),                -- GR rhotacised final in third tone
  GRFinal_T4 VARCHAR(7),                -- GR rhotacised final in forth tone
  GRFinal_T3_ZEROINITIAL VARCHAR(7),    -- GR rhotacised final in third tone
                                        --   with zero initial
  GRFinal_T4_ZEROINITIAL VARCHAR(7)     -- GR rhotacised final in forth tone
                                        --   with zero initial
);
