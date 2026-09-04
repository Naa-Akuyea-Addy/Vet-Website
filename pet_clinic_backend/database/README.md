# addyPets veterinary clinic database

These scripts target Oracle Database and use the environment values in `../.env`.

Run them in this order as the application schema owner:

```sql
@schema.sql
@seed.sql
```

`schema.sql` creates the tables used by the public pages and admin dashboard. `seed.sql` adds non-sensitive roles, notification preferences, and clinic defaults. Create the first real user through the existing registration flow so the password is stored as a bcrypt hash.

If the older schema has already been installed, run `migrate_pet_columns.sql` once before using the updated booking flow. It renames the patient profile fields to `pet_species`, `pet_breed`, and `pet_age`, and changes age storage to match the website values such as `2 years`.

For automatic veterinarian assignment, run `link_staff_users.sql` once. Each veterinarian must have an active `STAFF` record and an active `USERS` account with the same email address. The server assigns the eligible vet with the fewest pending or confirmed appointments.

For development data, `seed_veterinarian_users.sql` creates missing active `Veterinarian` user accounts for unlinked staff numbers beginning with `VET`. Every created account uses the temporary password `ChangeMe123!`; change or replace these accounts before production use.

## Billing data retention

Automatic deletion is disabled by default. After the clinic's data-protection authority approves a retention period, add a positive whole-number value to `../.env` and restart the server:

```env
BILLING_RETENTION_YEARS=7
```

The server then removes billing rows whose `ISSUED_AT` value is older than that period at startup and once every 24 hours. Choose the approved period before enabling this setting; the deletion is permanent. Records subject to legal, tax, clinical, or audit holds must be excluded before enabling an automated purge policy.

Appointments use a separate setting and their stored creation date:

```env
APPOINTMENT_RETENTION_YEARS=7
```
