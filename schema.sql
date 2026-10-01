-- LEADATHON 2026 — MySQL schema
-- Apply with: mysql -h HOST -P PORT -u USER -p DBNAME < schema.sql
-- (Hostinger auto-provisions DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD env vars.)

CREATE TABLE IF NOT EXISTS registrations (
  id                 CHAR(36)      NOT NULL PRIMARY KEY,
  team_name          VARCHAR(255)  NOT NULL,
  participants_count INT           NOT NULL,
  problem_category   VARCHAR(255)  NOT NULL,
  problem_code       VARCHAR(255)  NULL,
  problem_title      VARCHAR(500)  NOT NULL,
  problem_statement  TEXT          NOT NULL,
  project_stage      VARCHAR(100)  NOT NULL,
  idea_summary       TEXT          NULL,
  consent            BOOLEAN       NOT NULL DEFAULT FALSE,
  primary_name       VARCHAR(255)  NOT NULL,
  primary_phone      VARCHAR(20)   NOT NULL,
  primary_email      VARCHAR(255)  NOT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS participants (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  registration_id  CHAR(36)      NOT NULL,
  idx              INT           NOT NULL,
  name             VARCHAR(255)  NOT NULL,
  phone            VARCHAR(20)   NOT NULL,
  email            VARCHAR(255)  NOT NULL,
  profile          VARCHAR(100)  NOT NULL,
  institution      VARCHAR(255)  NULL,
  qr_token         VARCHAR(64)   NOT NULL UNIQUE,
  status           VARCHAR(20)   NOT NULL DEFAULT 'registered',
  checked_in_at    DATETIME      NULL,
  checked_out_at   DATETIME      NULL,
  email_sent_at    DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_participants_registration
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX participants_reg_idx    ON participants(registration_id);
CREATE INDEX participants_status_idx ON participants(status);
-- qr_token's UNIQUE constraint already creates its own index.
