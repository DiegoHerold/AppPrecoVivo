ALTER TABLE "UserSettings"
ADD COLUMN "themePreset" TEXT NOT NULL DEFAULT 'claro_vivo',
ADD COLUMN "favoriteThemes" TEXT[] NOT NULL DEFAULT ARRAY['claro_vivo', 'escuro_aurora']::TEXT[];
