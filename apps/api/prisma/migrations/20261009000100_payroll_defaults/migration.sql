-- Required reference data, editable by HR later. Idempotent.
WITH new_table AS (
  INSERT INTO "tax_tables" ("id", "name", "is_default", "updated_at")
  SELECT gen_random_uuid(), 'Standard', true, CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "tax_tables" WHERE "is_default")
    AND NOT EXISTS (SELECT 1 FROM "tax_tables" WHERE lower("name") = 'standard')
  RETURNING "id"
)
INSERT INTO "tax_brackets" ("id", "tax_table_id", "position", "up_to", "rate", "updated_at")
SELECT gen_random_uuid(), t."id", b."position", b."up_to", b."rate", CURRENT_TIMESTAMP
FROM new_table t
CROSS JOIN (VALUES (0, 10000.00, 0.00), (1, 20000.00, 10.00), (2, NULL::numeric, 15.00)) AS b("position", "up_to", "rate");

INSERT INTO "social_insurance_settings" ("id", "rate", "cap", "updated_at")
VALUES (1, 11.00, 2000.00, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
