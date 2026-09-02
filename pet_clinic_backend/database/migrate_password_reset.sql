-- Run once against the application schema before enabling password resets.
ALTER TABLE users ADD (
  password_reset_token_hash VARCHAR2(64),
  password_reset_expires_at TIMESTAMP
);

CREATE INDEX users_password_reset_ix
  ON users(password_reset_token_hash);
