CREATE TABLE StrokeOrder (
  ChineseCharacter CHAR(1) NOT NULL,        -- Chinese character (includes
                                            -- radical forms)
  StrokeOrder VARCHAR(50) NOT NULL,         -- Stroke order, strokes abbreviated
  Glyph INTEGER NOT NULL DEFAULT 0,         -- Glyph of character
  Flags VARCHAR(5) DEFAULT '',              -- Flags, (O) checked, (S) variant
                                            --  found only as sub part
  PRIMARY KEY (ChineseCharacter, Glyph)
);
