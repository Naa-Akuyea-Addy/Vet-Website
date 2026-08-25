# addyPets veterinary clinic database

These scripts target Oracle Database and use the environment values in `../.env`.

Run them in this order as the application schema owner:

```sql
@schema.sql
@seed.sql
```

`schema.sql` creates the tables used by the public pages and admin dashboard. `seed.sql` adds non-sensitive roles, notification preferences, and clinic defaults. Create the first real user through the existing registration flow so the password is stored as a bcrypt hash.

If the older schema has already been installed, run `migrate_pet_columns.sql` once before using the updated booking flow. It renames the patient profile fields to `pet_species`, `pet_breed`, and `pet_age`, and changes age storage to match the website values such as `2 years`.
