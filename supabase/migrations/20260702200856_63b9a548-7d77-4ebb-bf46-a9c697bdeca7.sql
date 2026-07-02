
CREATE TABLE public.legal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid NULL,
  updated_by uuid NULL,

  name text NOT NULL,
  description text NULL,
  internal_notes text NULL,

  legal_area text NULL,
  piece_type text NULL,
  main_topic text NULL,
  subtopic text NULL,
  represented_party text NULL,
  procedural_stage text NULL,

  status text NOT NULL DEFAULT 'active',

  file_name text NULL,
  file_path text NULL,
  file_mime_type text NULL,
  file_size_bytes bigint NULL,

  extracted_text text NULL,
  structure_summary text NULL,
  style_summary text NULL,
  standard_sections jsonb NULL,
  topic_structure jsonb NULL,
  writing_patterns jsonb NULL,
  request_patterns jsonb NULL,
  risk_notes jsonb NULL,
  usage_guidelines text NULL,

  analysis_status text NOT NULL DEFAULT 'pending',
  analysis_error text NULL,
  analysis_model text NULL,
  analyzed_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT legal_templates_status_check CHECK (status IN ('active','inactive','in_review')),
  CONSTRAINT legal_templates_analysis_status_check CHECK (analysis_status IN ('pending','processing','done','error'))
);

CREATE INDEX legal_templates_org_idx ON public.legal_templates (organization_id);
CREATE INDEX legal_templates_org_status_idx ON public.legal_templates (organization_id, status);
CREATE INDEX legal_templates_org_area_type_idx ON public.legal_templates (organization_id, legal_area, piece_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_templates TO authenticated;
GRANT ALL ON public.legal_templates TO service_role;

ALTER TABLE public.legal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view templates of their organization"
  ON public.legal_templates FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Members can insert templates in their organization"
  ON public.legal_templates FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "Members can update templates of their organization"
  ON public.legal_templates FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "Members can delete templates of their organization"
  ON public.legal_templates FOR DELETE
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER legal_templates_set_updated_at
  BEFORE UPDATE ON public.legal_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the private bucket 'legal-templates'.
-- Path convention: <organization_id>/<template_id>/<sanitized_filename>
-- The bucket itself is created via the storage_create_bucket tool.

CREATE POLICY "Members read own org template files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'legal-templates'
    AND (storage.foldername(name))[1] = public.get_my_organization_id()::text
  );

CREATE POLICY "Members upload template files in own org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'legal-templates'
    AND (storage.foldername(name))[1] = public.get_my_organization_id()::text
  );

CREATE POLICY "Members update template files in own org"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'legal-templates'
    AND (storage.foldername(name))[1] = public.get_my_organization_id()::text
  )
  WITH CHECK (
    bucket_id = 'legal-templates'
    AND (storage.foldername(name))[1] = public.get_my_organization_id()::text
  );

CREATE POLICY "Members delete template files in own org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'legal-templates'
    AND (storage.foldername(name))[1] = public.get_my_organization_id()::text
  );
