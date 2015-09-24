CREATE TABLE Strokes (
  StrokeAbbrev VARCHAR(10) PRIMARY KEY, -- Abbreviated stroke name
  Name VARCHAR(20) UNIQUE,              -- Chinese stroke name
  Stroke VARCHAR(3) NOT NULL            -- Stroke char or placeholder
);
