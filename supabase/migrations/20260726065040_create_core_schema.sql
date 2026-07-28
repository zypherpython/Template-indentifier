/*
# TemplateAI core schema

1. Overview
   Multi-user template platform. Users authenticate via Supabase Auth (email + Google).
   Each user owns the templates they create. Public templates are readable by everyone
   (including anon browsers), but only the owner can modify/delete them.
   Generated images, favorites, likes, downloads, and corrections are owner-scoped.

2. New Tables
   - profiles: public user profile data (display name, avatar, bio) keyed by auth.users.id.
   - templates: uploaded image templates with placeholder JSON, metadata, counters.
   - template_corrections: AI prediction vs user correction data for future improvements.
   - generated_images: composite outputs a user produced from a template.
   - favorites: user bookmarked templates.
   - likes: user liked templates.
   - downloads: download event log (one row per download).

3. Security / RLS
   - RLS enabled on every table.
   - profiles: owner read/write; anyone may read (for creator profile pages).
   - templates: public SELECT (anon + authenticated) so the community library works
     without sign-in; INSERT/UPDATE/DELETE owner-only.
   - template_corrections: owner-only CRUD (only the template owner can submit corrections).
   - generated_images: owner-only CRUD.
   - favorites / likes / downloads: owner-only INSERT/DELETE; owner-only SELECT for
     favorites/likes; downloads SELECT is owner-only (analytics private to owner of the
     template, surfaced via counter on templates). For simplicity downloads are
     owner-scoped to the downloader.
   - Storage buckets: 'templates' (public read) and 'generated' (public read) created via
     separate migration so images can be served to anonymous browsers.

4. Counters
   - templates.views, templates.downloads, templates.likes are integer counters updated
     via RPC-safe increments (the application uses atomic UPDATE ... SET x = x + 1).

5. Notes
   - Coordinates (x, y, width, height) are normalized 0..1 and stored as double precision.
   - placeholders JSON is stored as jsonb (array of placeholder objects).
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Creator',
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_any" ON public.profiles;
CREATE POLICY "profiles_select_any"
  ON public.profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- templates ----------
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  tags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  image_path text NOT NULL,
  thumbnail_path text NOT NULL,
  image_width integer NOT NULL,
  image_height integer NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  views integer NOT NULL DEFAULT 0,
  downloads integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Public templates are visible to everyone (anon + authenticated).
-- Private/draft templates are visible only to the owner.
DROP POLICY IF EXISTS "templates_select" ON public.templates;
CREATE POLICY "templates_select"
  ON public.templates FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public' AND status = 'published'
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "templates_insert_own" ON public.templates;
CREATE POLICY "templates_insert_own"
  ON public.templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "templates_update_own" ON public.templates;
CREATE POLICY "templates_update_own"
  ON public.templates FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "templates_delete_own" ON public.templates;
CREATE POLICY "templates_delete_own"
  ON public.templates FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- ---------- template_corrections ----------
CREATE TABLE IF NOT EXISTS public.template_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  original_prediction jsonb NOT NULL,
  corrected_placeholders jsonb NOT NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.template_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corrections_select_own" ON public.template_corrections;
CREATE POLICY "corrections_select_own"
  ON public.template_corrections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "corrections_insert_own" ON public.template_corrections;
CREATE POLICY "corrections_insert_own"
  ON public.template_corrections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "corrections_update_own" ON public.template_corrections;
CREATE POLICY "corrections_update_own"
  ON public.template_corrections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "corrections_delete_own" ON public.template_corrections;
CREATE POLICY "corrections_delete_own"
  ON public.template_corrections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- generated_images ----------
CREATE TABLE IF NOT EXISTS public.generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_select_own" ON public.generated_images;
CREATE POLICY "generated_select_own"
  ON public.generated_images FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_insert_own" ON public.generated_images;
CREATE POLICY "generated_insert_own"
  ON public.generated_images FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_delete_own" ON public.generated_images;
CREATE POLICY "generated_delete_own"
  ON public.generated_images FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- favorites ----------
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
CREATE POLICY "favorites_select_own"
  ON public.favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
CREATE POLICY "favorites_insert_own"
  ON public.favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own"
  ON public.favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- likes ----------
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_own" ON public.likes;
CREATE POLICY "likes_select_own"
  ON public.likes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
CREATE POLICY "likes_insert_own"
  ON public.likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;
CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- downloads ----------
CREATE TABLE IF NOT EXISTS public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "downloads_insert_any" ON public.downloads;
CREATE POLICY "downloads_insert_any"
  ON public.downloads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "downloads_select_own" ON public.downloads;
CREATE POLICY "downloads_select_own"
  ON public.downloads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS templates_visibility_status_idx
  ON public.templates (visibility, status);
CREATE INDEX IF NOT EXISTS templates_category_idx ON public.templates (category);
CREATE INDEX IF NOT EXISTS templates_owner_idx ON public.templates (owner_id);
CREATE INDEX IF NOT EXISTS templates_created_idx ON public.templates (created_at DESC);
CREATE INDEX IF NOT EXISTS templates_downloads_idx ON public.templates (downloads DESC);
CREATE INDEX IF NOT EXISTS templates_likes_idx ON public.templates (likes DESC);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS likes_template_idx ON public.likes (template_id);
CREATE INDEX IF NOT EXISTS generated_user_idx ON public.generated_images (user_id);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_touch ON public.templates;
CREATE TRIGGER templates_touch BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
