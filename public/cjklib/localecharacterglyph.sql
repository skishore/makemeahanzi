CREATE TABLE LocaleCharacterGlyph (
  ChineseCharacter CHAR(1) NOT NULL,        -- Chinese character (includes
                                            -- radical forms)
  Glyph INTEGER NOT NULL DEFAULT 0,         -- Glyph of character
  Locale VARCHAR(6) NOT NULL DEFAULT '',    -- Locale (T) traditional,
                                            --  (C) simplified Chinese,
                                            --  (J) Japanese,
                                            --  (K) Korean, (V) Vietnamese
  PRIMARY KEY (ChineseCharacter, Locale),
  UNIQUE (ChineseCharacter, Glyph)
);
