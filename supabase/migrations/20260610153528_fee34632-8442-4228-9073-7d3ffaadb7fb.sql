
DO $$
DECLARE
  target_org uuid := '2a4a4b01-a471-4bb4-a7a7-65048db8983c';
  src_orgs uuid[] := ARRAY[
    '4f2e1fea-130e-4376-8906-600af66d4f4f'::uuid,
    '105fbd54-6837-44fb-acd4-f3099dbef338'::uuid,
    'f269be1c-b702-47c8-8e84-af2524f5b499'::uuid,
    '0d98fcf9-d140-4ac7-a452-78bbaf7a48d6'::uuid
  ];
BEGIN
  UPDATE public.clients               SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.cases                 SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.case_movements        SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.documents             SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.document_versions     SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.document_chat_messages SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.client_files          SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.client_interactions   SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.tasks                 SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.publications          SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.ai_usage_log          SET organization_id = target_org WHERE organization_id = ANY(src_orgs);
  UPDATE public.finances              SET organization_id = target_org WHERE organization_id = ANY(src_orgs);

  -- Move membros e rebaixa para 'lawyer'
  UPDATE public.profiles
     SET organization_id = target_org,
         role = 'lawyer'
   WHERE id IN (
     'fd7ac004-afde-4fc9-8d1f-74099c4a983d', -- Renata
     '6bb74356-6f5a-489e-8af0-457d87bf76f9', -- Higor
     '5597f075-531f-4fe1-b1c1-d4c9a8a0cb4b', -- Juan
     'bfd1e562-52e3-463e-86bb-e3436e264758'  -- Leonardo
   );
END$$;
