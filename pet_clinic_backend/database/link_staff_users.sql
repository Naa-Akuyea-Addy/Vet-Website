-- Run once as the application schema owner.
-- It links existing staff members to the portal user with the same email,
-- without changing staff records that are already linked.
UPDATE staff s
SET s.user_id = (
  SELECT u.user_id
  FROM users u
  WHERE LOWER(u.email) = LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid'))
)
WHERE s.user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM users u
    WHERE LOWER(u.email) = LOWER(NVL(TRIM(s.email), LOWER(s.staff_number) || '@vet.addypets.invalid'))
  );
