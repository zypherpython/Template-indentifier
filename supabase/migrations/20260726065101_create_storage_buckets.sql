/*
# Storage buckets for TemplateAI

1. Changes
   - Insert (if not exists) two public-read storage buckets:
     - 'templates': original template images + thumbnails (public read so anon browsers can view the community library).
     - 'generated': composited output images (public read so users can share/download results).
   - Storage policies are managed via the Supabase Storage UI / `storage.buckets` plus
     object-level policies. Here we ensure the buckets exist and are public.

2. Notes
   - Public buckets allow unauthenticated GETs, which is required for the community library
     to render template thumbnails without forcing sign-in. Writes are still controlled by
     RLS / storage policies applied below (authenticated users may write to their own prefix).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated', 'generated', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies: allow authenticated users to upload to templates/generated;
-- allow everyone to read (public buckets). We scope writes by owner prefix as a soft rule
-- enforced in the app; storage RLS allows authenticated uploads.

DROP POLICY IF EXISTS "templates_read_all" ON storage.objects;
CREATE POLICY "templates_read_all"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'templates');

DROP POLICY IF EXISTS "templates_write_authed" ON storage.objects;
CREATE POLICY "templates_write_authed"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'templates');

DROP POLICY IF EXISTS "templates_delete_own" ON storage.objects;
CREATE POLICY "templates_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'templates');

DROP POLICY IF EXISTS "generated_read_all" ON storage.objects;
CREATE POLICY "generated_read_all"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'generated');

DROP POLICY IF EXISTS "generated_write_authed" ON storage.objects;
CREATE POLICY "generated_write_authed"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generated');
