-- Ensure AdminUser table exists (idempotent)
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");

-- Upsert admin credentials (username: ubaid, password: a7382811)
INSERT INTO "AdminUser" ("id", "username", "passwordHash", "createdAt")
VALUES (
  gen_random_uuid(),
  'ubaid',
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:7465f9aff6815477d2d70eb8fc890ddd1daa0e51d00a0a07820f104716c76a4a3298e810ddc9977c319d837694fe70df35c07442a2775036d002602acc1ef5b5',
  NOW()
)
ON CONFLICT ("username") DO UPDATE
  SET "passwordHash" = EXCLUDED."passwordHash";
