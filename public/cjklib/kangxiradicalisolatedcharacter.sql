CREATE TABLE KangxiRadicalIsolatedCharacter (
  RadicalIndex INTEGER NOT NULL,            -- Radical index
  EquivalentForm CHAR(1) NOT NULL,          -- Radical equivalent character
  Type CHAR(1) NOT NULL,                    -- Type, (R) radical, (V) variant
  Locale VARCHAR(6) NOT NULL DEFAULT '',    -- Locale (T) traditional,
                                            --  (C) simplified Chinese,
                                            --  (J) Japanese,
                                            --  (K) Korean, (V) Vietnamese
  PRIMARY KEY (EquivalentForm, Locale),
  UNIQUE (RadicalIndex, EquivalentForm)
);
