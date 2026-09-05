-- Existing databases that already ran seed before documents.analyze / documents.read
-- existed in the catalog would otherwise 403 those routes until a manual re-seed.
INSERT INTO permissions (id, key, description, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'documents.analyze',
    'Upload and analyze documents with AI',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'documents.read',
    'Read document analysis results',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'manager')
  AND p.key IN ('documents.analyze', 'documents.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;
