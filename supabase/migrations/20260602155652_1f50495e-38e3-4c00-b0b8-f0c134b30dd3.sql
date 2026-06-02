ALTER TABLE public.cases
  ADD COLUMN represented_party text
  CHECK (represented_party IN ('autor','reu','recorrente','recorrido','exequente','executado','terceiro','outro'));

ALTER TABLE public.client_files
  ADD COLUMN represented_party text
  CHECK (represented_party IN ('autor','reu','recorrente','recorrido','exequente','executado','terceiro','outro'));