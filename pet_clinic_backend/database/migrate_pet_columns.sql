-- Run once against an existing database created with the older schema.sql.
-- Do not run this after creating the current schema.sql from scratch.

ALTER TABLE patients RENAME COLUMN species TO pet_species;
ALTER TABLE patients RENAME COLUMN breed TO pet_breed;
ALTER TABLE patients RENAME COLUMN age TO pet_age;
ALTER TABLE patients MODIFY (pet_age VARCHAR2(30));
ALTER TABLE appointments MODIFY (pet_age VARCHAR2(30));
ALTER TABLE appointments MODIFY (appointment_time VARCHAR2(20));

COMMIT;
