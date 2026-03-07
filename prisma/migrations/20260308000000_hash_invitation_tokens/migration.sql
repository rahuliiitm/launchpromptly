-- Rename plaintext token column to tokenHash
ALTER TABLE "Invitation" RENAME COLUMN "token" TO "tokenHash";

-- Hash existing plaintext tokens with SHA256
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "Invitation" SET "tokenHash" = encode(digest("tokenHash", 'sha256'), 'hex')
WHERE "tokenHash" IS NOT NULL;
