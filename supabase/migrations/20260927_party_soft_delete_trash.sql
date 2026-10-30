-- Migration: Add is_deleted support to parties and showroom_parties for Soft Delete / Trash & Archival
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_parties_is_deleted ON parties(is_deleted);
CREATE INDEX IF NOT EXISTS idx_showroom_parties_is_deleted ON showroom_parties(is_deleted);

NOTIFY pgrst, 'reload schema';
