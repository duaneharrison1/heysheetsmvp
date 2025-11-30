-- Create admin_images table for storing image metadata
CREATE TABLE IF NOT EXISTS admin_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster sorting by name and date
CREATE INDEX IF NOT EXISTS admin_images_name_idx ON admin_images(name);
CREATE INDEX IF NOT EXISTS admin_images_created_at_idx ON admin_images(created_at DESC);

-- Enable RLS
ALTER TABLE admin_images ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins or store owners can read images
CREATE POLICY "Admins or store owners can read admin_images" ON admin_images
  FOR SELECT
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Policy: Super admins or store owners can insert images
CREATE POLICY "Admins or store owners can insert admin_images" ON admin_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Policy: Super admins or store owners can update images
CREATE POLICY "Admins or store owners can update admin_images" ON admin_images
  FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Policy: Super admins or store owners can delete images
CREATE POLICY "Admins or store owners can delete admin_images" ON admin_images
  FOR DELETE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Create storage bucket for admin images (public access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-images', 'admin-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can read from the bucket (public images)
CREATE POLICY "Public read access for admin-images" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'admin-images');

-- Policy: Super admins or store owners can upload to the bucket
CREATE POLICY "Admins or store owners can upload admin-images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-images'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Policy: Super admins or store owners can update in the bucket
CREATE POLICY "Admins or store owners can update admin-images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'admin-images'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );

-- Policy: Super admins or store owners can delete from the bucket
CREATE POLICY "Admins or store owners can delete admin-images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-images'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.user_id = auth.uid()
      )
    )
  );
