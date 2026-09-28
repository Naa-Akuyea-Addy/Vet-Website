-- ============================================================
-- Migrate: Create BOOKINGS table
-- Links appointment bookings (from external website/form) to
-- the APPOINTMENTS table.
-- ============================================================

-- Create BOOKINGS table if it does not already exist
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE BOOKINGS (
      BOOKING_ID         NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      APPOINTMENT_ID     NUMBER REFERENCES APPOINTMENTS(APPOINTMENT_ID) ON DELETE CASCADE,
      BOOKING_REFERENCE  VARCHAR2(30) UNIQUE,
      BOOKING_SOURCE     VARCHAR2(50) DEFAULT ''website'',
      CUSTOMER_NAME      VARCHAR2(200),
      CUSTOMER_EMAIL     VARCHAR2(200),
      CUSTOMER_PHONE     VARCHAR2(30),
      PET_NAME           VARCHAR2(100),
      SERVICE_REQUESTED  VARCHAR2(200),
      PREFERRED_DATE     DATE,
      PREFERRED_TIME     VARCHAR2(20),
      NOTES              CLOB,
      STATUS             VARCHAR2(20) DEFAULT ''Pending'',
      CREATED_AT         TIMESTAMP DEFAULT SYSTIMESTAMP
    )';
  DBMS_OUTPUT.PUT_LINE('BOOKINGS table created.');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('BOOKINGS table already exists. Skipping.');
    ELSE
      RAISE;
    END IF;
END;
/

-- Create index for lookups on appointment_id
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IDX_BOOKINGS_APPT ON BOOKINGS(APPOINTMENT_ID)';
  DBMS_OUTPUT.PUT_LINE('Index IDX_BOOKINGS_APPT created.');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Index already exists. Skipping.');
    ELSE
      RAISE;
    END IF;
END;
/

-- Seed: Generate a BOOKING_REFERENCE for every existing appointment that
-- doesn't yet have a booking record, so the JOIN returns useful data.
MERGE INTO BOOKINGS b
USING (
  SELECT APPOINTMENT_ID,
         'BK-' || LPAD(APPOINTMENT_ID, 5, '0') AS BOOKING_REFERENCE,
         'portal' AS BOOKING_SOURCE
  FROM APPOINTMENTS a
  WHERE NOT EXISTS (SELECT 1 FROM BOOKINGS bk WHERE bk.APPOINTMENT_ID = a.APPOINTMENT_ID)
) src
ON (b.APPOINTMENT_ID = src.APPOINTMENT_ID)
WHEN NOT MATCHED THEN
  INSERT (APPOINTMENT_ID, BOOKING_REFERENCE, BOOKING_SOURCE)
  VALUES (src.APPOINTMENT_ID, src.BOOKING_REFERENCE, src.BOOKING_SOURCE);

COMMIT;
