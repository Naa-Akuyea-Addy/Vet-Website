-- One-time development seed for veterinarian staff records.
-- Creates an active portal account for every unlinked STAFF row whose staff
-- number begins with VET. Existing users are never changed or duplicated.
-- Temporary password for all created accounts: ChangeMe123!
-- Replace these demo credentials before deploying the system.

INSERT INTO users (
  email,
  password_hash,
  full_name,
  role,
  license_number,
  phone,
  status,
  created_at
)
SELECT
  LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid')),
  '$2b$10$uy57/ZrG9HdaJnggSM4/QO.W6ys/VIckv51IhUyzeZDQ5e/pL0GJm',
  s.full_name,
  'Veterinarian',
  NULL,
  s.phone,
  'Active',
  SYSTIMESTAMP
FROM staff s
WHERE UPPER(s.staff_number) LIKE 'VET%'
  AND s.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE LOWER(u.email) = LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid'))
  );

-- Link the newly created account (or a pre-existing matching account) back to STAFF.
UPDATE staff s
SET s.user_id = (
  SELECT u.user_id
  FROM users u
  WHERE LOWER(u.email) = LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid'))
)
WHERE UPPER(s.staff_number) LIKE 'VET%'
  AND s.user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM users u
    WHERE LOWER(u.email) = LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid'))
  );

COMMIT;
