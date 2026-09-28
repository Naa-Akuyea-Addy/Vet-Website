-- Migration: Normalize USERS and STAFF tables & eliminate duplicate columns
-- Run as application schema owner.

-- 1. Ensure required work columns exist on STAFF table
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'LICENSE_NUMBER';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE staff ADD (license_number VARCHAR2(100))';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'SALARY';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE staff ADD (salary NUMBER(12,2))';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'DEPARTMENT';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE staff ADD (department VARCHAR2(80))';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'JOB_TITLE';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE staff ADD (job_title VARCHAR2(80))';
  END IF;
END;
/

-- 2. Link existing STAFF records to USERS by email or name if user_id is NULL
DECLARE
  v_has_email NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_has_email FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'EMAIL';
  IF v_has_email > 0 THEN
    EXECUTE IMMEDIATE '
      UPDATE staff s
      SET s.user_id = (
        SELECT u.user_id
        FROM users u
        WHERE LOWER(u.email) = LOWER(s.email)
      )
      WHERE s.user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE LOWER(u.email) = LOWER(s.email)
        )
    ';
  END IF;
END;
/

-- 3. Copy license_number from USERS to STAFF if present in USERS
DECLARE
  v_has_license NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_has_license FROM user_tab_cols WHERE table_name = 'USERS' AND column_name = 'LICENSE_NUMBER';
  IF v_has_license > 0 THEN
    EXECUTE IMMEDIATE '
      UPDATE staff s
      SET s.license_number = (
        SELECT u.license_number
        FROM users u
        WHERE u.user_id = s.user_id
          AND u.license_number IS NOT NULL
      )
      WHERE s.license_number IS NULL
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE u.user_id = s.user_id
            AND u.license_number IS NOT NULL
        )
    ';
  END IF;
END;
/

-- 4. Create missing USERS for unlinked staff members
DECLARE
  v_has_staff_cols NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_has_staff_cols FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = 'FULL_NAME';
  IF v_has_staff_cols > 0 THEN
    EXECUTE IMMEDIATE '
      INSERT INTO users (email, password_hash, full_name, phone, role, status, created_at)
      SELECT
        NVL(s.email, LOWER(NVL(s.staff_number, ''staff'')) || ''@vet.addypets.invalid''),
        ''$2b$10$uy57/ZrG9HdaJnggSM4/QO.W6ys/VIckv51IhUyzeZDQ5e/pL0GJm'',
        NVL(s.full_name, ''Clinic Staff''),
        NVL(s.phone, ''''),
        NVL(s.job_title, ''Veterinarian''),
        NVL(s.status, ''Active''),
        SYSTIMESTAMP
      FROM staff s
      WHERE s.user_id IS NULL
    ';

    EXECUTE IMMEDIATE '
      UPDATE staff s
      SET s.user_id = (
        SELECT u.user_id
        FROM users u
        WHERE LOWER(u.email) = LOWER(NVL(s.email, LOWER(NVL(s.staff_number, ''staff'')) || ''@vet.addypets.invalid''))
      )
      WHERE s.user_id IS NULL
    ';
  END IF;
END;
/

-- 5. Drop duplicate columns from STAFF (personal info now exclusively in USERS)
DECLARE
  PROCEDURE drop_staff_col(p_col VARCHAR2) IS
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt FROM user_tab_cols WHERE table_name = 'STAFF' AND column_name = UPPER(p_col);
    IF v_cnt > 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE staff DROP COLUMN ' || p_col;
    END IF;
  END;
BEGIN
  drop_staff_col('FULL_NAME');
  drop_staff_col('EMAIL');
  drop_staff_col('PHONE');
  drop_staff_col('STATUS');
  drop_staff_col('ROLE');
END;
/

-- 6. Drop work-related columns from USERS (work info now exclusively in STAFF)
DECLARE
  PROCEDURE drop_user_col(p_col VARCHAR2) IS
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt FROM user_tab_cols WHERE table_name = 'USERS' AND column_name = UPPER(p_col);
    IF v_cnt > 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE users DROP COLUMN ' || p_col;
    END IF;
  END;
BEGIN
  drop_user_col('LICENSE_NUMBER');
  drop_user_col('SPECIALTY');
  drop_user_col('DEPARTMENT');
  drop_user_col('JOB_TITLE');
  drop_user_col('SALARY');
  drop_user_col('STAFF_NUMBER');
END;
/

-- 7. Ensure constraints & indexes
DECLARE
  v_uq_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_uq_cnt FROM user_constraints WHERE table_name = 'STAFF' AND constraint_name = 'STAFF_USER_UQ';
  IF v_uq_cnt = 0 THEN
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE staff ADD CONSTRAINT staff_user_uq UNIQUE (user_id)';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE staff MODIFY (user_id NOT NULL)';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 8. Backfill missing PATIENT_ID in APPOINTMENTS & normalize with PATIENTS table
DECLARE
  CURSOR c_apts IS
    SELECT appointment_id, pet_name, pet_species, pet_age, owner_name, owner_phone
    FROM appointments
    WHERE patient_id IS NULL;
  v_pid NUMBER;
BEGIN
  FOR r IN c_apts LOOP
    -- Try finding matching patient first
    BEGIN
      SELECT patient_id INTO v_pid
      FROM (
        SELECT patient_id
        FROM patients
        WHERE UPPER(TRIM(pet_name)) = UPPER(TRIM(r.pet_name))
          AND UPPER(TRIM(owner_name)) = UPPER(TRIM(r.owner_name))
        ORDER BY patient_id ASC
      ) WHERE ROWNUM = 1;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_pid := NULL;
    END;

    -- If no existing patient, create one
    IF v_pid IS NULL THEN
      INSERT INTO patients (pet_name, pet_species, pet_age, owner_name, owner_phone, created_at)
      VALUES (
        NVL(r.pet_name, 'Pet'),
        NVL(r.pet_species, 'Dog'),
        NVL(r.pet_age, '1 year'),
        NVL(r.owner_name, 'Owner'),
        NVL(r.owner_phone, ''),
        SYSTIMESTAMP
      )
      RETURNING patient_id INTO v_pid;
    END IF;

    -- Link appointment to patient
    UPDATE appointments
    SET patient_id = v_pid
    WHERE appointment_id = r.appointment_id;
  END LOOP;
END;
/

-- 9. Ensure UPDATED_AT column on APPOINTMENTS
DECLARE
  v_has_upd NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_has_upd FROM user_tab_cols WHERE table_name = 'APPOINTMENTS' AND column_name = 'UPDATED_AT';
  IF v_has_upd = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE appointments ADD (updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)';
  END IF;
END;
/

-- 10. Normalize BILLING with PATIENTS and APPOINTMENTS
BEGIN
  -- Sync billing.patient_id from appointments where missing
  EXECUTE IMMEDIATE '
    UPDATE billing b
    SET b.patient_id = (
      SELECT a.patient_id
      FROM appointments a
      WHERE a.appointment_id = b.appointment_id
        AND a.patient_id IS NOT NULL
    )
    WHERE b.patient_id IS NULL
      AND b.appointment_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.appointment_id = b.appointment_id
          AND a.patient_id IS NOT NULL
      )
  ';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 11. Ensure Foreign Key Constraints
DECLARE
  PROCEDURE add_fk(p_table VARCHAR2, p_constraint VARCHAR2, p_sql VARCHAR2) IS
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt FROM user_constraints WHERE table_name = UPPER(p_table) AND constraint_name = UPPER(p_constraint);
    IF v_cnt = 0 THEN
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD CONSTRAINT ' || p_constraint || ' ' || p_sql;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END;
BEGIN
  add_fk('APPOINTMENTS', 'FK_APPOINTMENTS_PATIENT', 'FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL');
  add_fk('APPOINTMENTS', 'FK_APPOINTMENTS_VET', 'FOREIGN KEY (veterinarian_id) REFERENCES users(user_id) ON DELETE SET NULL');
  add_fk('BILLING', 'FK_BILLING_PATIENT', 'FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL');
  add_fk('BILLING', 'FK_BILLING_APPOINTMENT', 'FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL');
  add_fk('DOCTOR_AVAILABILITY', 'FK_DOC_AVAIL_STAFF', 'FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE');
END;
/

-- 12. Add Performance Indexes on Foreign Keys & Frequent Filters
DECLARE
  PROCEDURE add_idx(p_name VARCHAR2, p_sql VARCHAR2) IS
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt FROM user_indexes WHERE index_name = UPPER(p_name);
    IF v_cnt = 0 THEN
      BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX ' || p_name || ' ON ' || p_sql;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END;
BEGIN
  add_idx('IDX_APPOINTMENTS_PATIENT', 'appointments(patient_id)');
  add_idx('IDX_APPOINTMENTS_VET', 'appointments(veterinarian_id)');
  add_idx('IDX_APPOINTMENTS_STATUS', 'appointments(status)');
  add_idx('IDX_BILLING_PATIENT', 'billing(patient_id)');
  add_idx('IDX_BILLING_APT', 'billing(appointment_id)');
  add_idx('IDX_DOC_AVAIL_STAFF', 'doctor_availability(staff_id)');
  add_idx('IDX_STAFF_USER', 'staff(user_id)');
END;
/

COMMIT;

