-- Optional starter data for the admin dashboard.
-- Do not use real passwords or patient data in this file.

INSERT INTO roles (role_name, description, permissions_json)
VALUES ('Admin', 'Full system access', '{"all":true}');

INSERT INTO roles (role_name, description, permissions_json)
VALUES ('Veterinarian', 'Medical staff', '{"patients":["view","create","edit"],"appointments":["view","create","edit"],"emergencies":["view","create","edit"]}');

INSERT INTO roles (role_name, description, permissions_json)
VALUES ('Receptionist', 'Front desk staff', '{"patients":["view","create","edit"],"appointments":["view","create","edit"],"billing":["view","create"]}');

INSERT INTO notification_preferences (notification_key, email_enabled, sms_enabled, in_app_enabled)
VALUES ('appointment-reminder', 'Y', 'Y', 'Y');

INSERT INTO notification_preferences (notification_key, email_enabled, sms_enabled, in_app_enabled)
VALUES ('invoice-generated', 'Y', 'N', 'Y');

INSERT INTO notification_preferences (notification_key, email_enabled, sms_enabled, in_app_enabled)
VALUES ('payment-received', 'Y', 'N', 'Y');

INSERT INTO notification_preferences (notification_key, email_enabled, sms_enabled, in_app_enabled)
VALUES ('inventory-low-stock', 'Y', 'N', 'Y');

INSERT INTO notification_preferences (notification_key, email_enabled, sms_enabled, in_app_enabled)
VALUES ('emergency-alert', 'Y', 'Y', 'Y');

INSERT INTO clinic_settings (setting_key, setting_value)
VALUES ('clinic_name', 'addyPets Veterinary Clinic');

INSERT INTO clinic_settings (setting_key, setting_value)
VALUES ('currency', 'GHS');

COMMIT;
