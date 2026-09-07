UPDATE staff
SET staff_number = CASE
  WHEN LOWER(NVL(job_title, '')) LIKE '%technician%' THEN 'TECH-'
  WHEN LOWER(NVL(job_title, '')) LIKE '%vet%'
    OR LOWER(NVL(job_title, '')) LIKE '%veterinarian%'
    OR LOWER(NVL(job_title, '')) LIKE '%surgeon%' THEN 'VET-'
  WHEN LOWER(NVL(job_title, '')) LIKE '%reception%' THEN 'REC-'
  WHEN LOWER(NVL(job_title, '')) LIKE '%account%'
    OR LOWER(NVL(department, '')) LIKE '%finance%' THEN 'ACC-'
  WHEN LOWER(NVL(job_title, '')) LIKE '%inventory%' THEN 'INV-'
  ELSE 'STF-'
END || LPAD(TO_CHAR(staff_id), 4, '0');

CREATE OR REPLACE TRIGGER staff_number_from_id
FOR INSERT ON staff
COMPOUND TRIGGER
  staff_ids SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();

  AFTER EACH ROW IS
  BEGIN
    staff_ids.EXTEND;
    staff_ids(staff_ids.COUNT) := :NEW.staff_id;
  END AFTER EACH ROW;

  AFTER STATEMENT IS
  BEGIN
    UPDATE staff
    SET staff_number = CASE
      WHEN LOWER(NVL(job_title, '')) LIKE '%technician%' THEN 'TECH-'
      WHEN LOWER(NVL(job_title, '')) LIKE '%vet%'
        OR LOWER(NVL(job_title, '')) LIKE '%veterinarian%'
        OR LOWER(NVL(job_title, '')) LIKE '%surgeon%' THEN 'DOC-'
      WHEN LOWER(NVL(job_title, '')) LIKE '%reception%' THEN 'REC-'
      WHEN LOWER(NVL(job_title, '')) LIKE '%account%'
        OR LOWER(NVL(department, '')) LIKE '%finance%' THEN 'ACC-'
      WHEN LOWER(NVL(job_title, '')) LIKE '%inventory%' THEN 'INV-'
      ELSE 'STF-'
    END || LPAD(TO_CHAR(staff_id), 4, '0')
    WHERE staff_id IN (SELECT COLUMN_VALUE FROM TABLE(staff_ids));
  END AFTER STATEMENT;
END;
/

COMMIT;
