-- Remove passwordHash column from User — auth is now managed by Neon Auth
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
