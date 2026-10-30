-- Phase 5: persist dashboard UI preferences per user (sidebar theme sync)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_profiles.ui_preferences IS
  'Per-user UI preferences JSON (e.g. sidebar_theme for cross-device sync).';
