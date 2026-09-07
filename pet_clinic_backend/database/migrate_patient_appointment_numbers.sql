ALTER TABLE patients ADD (patient_number VARCHAR2(20) UNIQUE);
ALTER TABLE appointments ADD (appointment_number VARCHAR2(20) UNIQUE);

UPDATE patients
SET patient_number = 'PAT-' || LPAD(TO_CHAR(patient_id), 4, '0');

UPDATE appointments
SET appointment_number = 'APT-' || LPAD(TO_CHAR(appointment_id), 4, '0');

CREATE OR REPLACE TRIGGER patient_number_from_id
FOR INSERT ON patients
COMPOUND TRIGGER
  patient_ids SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();
  AFTER EACH ROW IS
  BEGIN
    patient_ids.EXTEND;
    patient_ids(patient_ids.COUNT) := :NEW.patient_id;
  END AFTER EACH ROW;
  AFTER STATEMENT IS
  BEGIN
    UPDATE patients
    SET patient_number = 'PAT-' || LPAD(TO_CHAR(patient_id), 4, '0')
    WHERE patient_id IN (SELECT COLUMN_VALUE FROM TABLE(patient_ids));
  END AFTER STATEMENT;
END;
/

CREATE OR REPLACE TRIGGER appointment_number_from_id
FOR INSERT ON appointments
COMPOUND TRIGGER
  appointment_ids SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();
  AFTER EACH ROW IS
  BEGIN
    appointment_ids.EXTEND;
    appointment_ids(appointment_ids.COUNT) := :NEW.appointment_id;
  END AFTER EACH ROW;
  AFTER STATEMENT IS
  BEGIN
    UPDATE appointments
    SET appointment_number = 'APT-' || LPAD(TO_CHAR(appointment_id), 4, '0')
    WHERE appointment_id IN (SELECT COLUMN_VALUE FROM TABLE(appointment_ids));
  END AFTER STATEMENT;
END;
/

COMMIT;
