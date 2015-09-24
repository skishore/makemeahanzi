CREATE TABLE KangxiRadical (
  RadicalIndex INTEGER NOT NULL,            -- Radical index
  Form CHAR(1) PRIMARY KEY,                 -- Radical character
  Type CHAR(1) NOT NULL,                    -- Type, (R) radical, (V) variant
  Locale VARCHAR(6) NOT NULL DEFAULT '',    -- Locale (T) traditional,
                                            --  (C) simplified Chinese,
                                            --  (J) Japanese,
                                            --  (K) Korean, (V) Vietnamese
  SubIndex INTEGER NOT NULL DEFAULT 0,      -- additional index for uniqueness
  UNIQUE (RadicalIndex, Type, SubIndex)
);