CREATE TABLE RadicalEquivalentCharacter (
  Form CHAR(1) NOT NULL,                    -- Radical character
  EquivalentForm CHAR(1) NOT NULL,          -- Radical equivalent character
  Locale VARCHAR(6) NOT NULL DEFAULT '',    -- Locale for mapping of forms
                                            --  (T) traditional,
                                            --  (C) simplified Chinese,
                                            --  (J) Japanese,
                                            --  (K) Korean, (V) Vietnamese
  PRIMARY KEY (Form, Locale),
  UNIQUE (Form, EquivalentForm)
);
