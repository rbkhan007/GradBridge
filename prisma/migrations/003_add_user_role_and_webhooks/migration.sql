-- Add role column to User (missing from 001_init, added to schema)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

-- WebhookEndpoint: user-registered callback endpoints
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
    "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId"    TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "events"    TEXT NOT NULL DEFAULT '[]',
    "enabled"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");

-- WebhookEvent: delivery log for each dispatch
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id"         TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId"     TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event"      TEXT NOT NULL,
    "payload"    TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "WebhookEvent_userId_fkey"      FOREIGN KEY ("userId")     REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "WebhookEvent_endpointId_fkey"  FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "WebhookEvent_userId_idx"     ON "WebhookEvent"("userId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_endpointId_idx" ON "WebhookEvent"("endpointId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_idx"     ON "WebhookEvent"("status");
