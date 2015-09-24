CREATE TABLE GRAbbreviation (
  TraditionalChinese VARCHAR(2),    -- Chinese character
  GR VARCHAR(18),                   -- ethymological GR form
  GRAbbreviation VARCHAR(18),       -- abbreviated GR form
  Specialised VARCHAR(3),           -- specialised information (T, S, I)
  UNIQUE(TraditionalChinese, GR, GRAbbreviation)
);
