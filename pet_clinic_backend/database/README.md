# addyPets veterinary clinic database

These scripts target Oracle Database and use the environment values in `../.env`.

Run them in this order as the application schema owner:

```sql
@schema.sql
@seed.sql
```

`schema.sql` creates the tables used by the public pages and admin dashboard. `seed.sql` adds non-sensitive roles, notification preferences, and clinic defaults. Create the first real user through the existing registration flow so the password is stored as a bcrypt hash.

## Schema Architecture: Users & Staff Normalization

The schema cleanly divides user and employee domain data:
- **`USERS` table**: Stores core personal profile & authentication attributes:
  - `user_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `profile_image`, `password_reset_token_hash`, `password_reset_expires_at`, `last_login`, `created_at`, `updated_at`.
- **`STAFF` table**: Stores professional and clinic employment details linked via foreign key:
  - `staff_id`, `user_id` (`NOT NULL UNIQUE REFERENCES users(user_id)`), `staff_number`, `license_number`, `department`, `job_title`, `salary`, `created_at`, `updated_at`.

### Existing Database Migration

If upgrading an existing schema with duplicate fields, run `migrate_normalize_users_staff.sql`. It:
1. Ensures work columns exist on `STAFF` and copies `license_number` from `USERS`.
2. Links unlinked `STAFF` records to `USERS`.
3. Drops duplicate personal columns (`full_name`, `email`, `phone`, `status`, `role`) from `STAFF`.
4. Drops work columns (`license_number`, `department`, `job_title`, `salary`) from `USERS`.
5. Establishes the unique and foreign key constraints on `STAFF(user_id)`.

## Billing & Appointment Data Retention

Automatic deletion is disabled by default. After the clinic's data-protection authority approves a retention period, add positive whole-number values to `../.env` and restart the server:

```env
BILLING_RETENTION_YEARS=7
APPOINTMENT_RETENTION_YEARS=7
```
