INSERT INTO "PathStage" ("order", "name", "iconKey", "description")
VALUES
  (1, 'Искра', 'spark', 'Творческий порыв'),
  (2, 'Формирование', 'mic', 'Становление бренда'),
  (3, 'Выход в свет', 'knobs', 'Первые успехи'),
  (4, 'Прорыв', 'record', 'Закрепление влияния'),
  (5, 'Признание', 'sliders', 'Стабильная аудитория'),
  (6, 'Широкая известность', 'wave', 'Медийный масштаб'),
  (7, 'Наследие', 'rocket', 'Культурное влияние')
ON CONFLICT ("order") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "iconKey" = EXCLUDED."iconKey",
  "description" = EXCLUDED."description";

DELETE FROM "PathStage"
WHERE "order" > 7;
