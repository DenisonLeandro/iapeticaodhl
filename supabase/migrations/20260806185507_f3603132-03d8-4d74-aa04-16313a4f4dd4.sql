ALTER TABLE public.case_calculation_items
  ADD COLUMN IF NOT EXISTS manual_value numeric,
  ADD COLUMN IF NOT EXISTS manual_value_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_value_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_value_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS manual_value_note text,
  ADD COLUMN IF NOT EXISTS system_value_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Alterar o valor manual invalida qualquer confirmação anterior (ato humano explícito é sempre novo)
CREATE OR REPLACE FUNCTION public.case_calculation_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' AND NEW.manual_value IS DISTINCT FROM OLD.manual_value THEN
    IF NEW.manual_value_confirmed = OLD.manual_value_confirmed THEN
      NEW.manual_value_confirmed := false;
      NEW.manual_value_confirmed_at := NULL;
      NEW.manual_value_confirmed_by := NULL;
    END IF;
  END IF;

  IF NEW.manual_value_confirmed THEN
    IF NEW.manual_value IS NULL THEN
      RAISE EXCEPTION 'Não é possível confirmar um valor manual vazio';
    END IF;
    NEW.manual_value_confirmed_at := COALESCE(NEW.manual_value_confirmed_at, now());
    NEW.manual_value_confirmed_by := COALESCE(NEW.manual_value_confirmed_by, auth.uid());
  ELSE
    NEW.manual_value_confirmed_at := NULL;
    NEW.manual_value_confirmed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_calculation_items_guard ON public.case_calculation_items;
CREATE TRIGGER trg_case_calculation_items_guard
BEFORE INSERT OR UPDATE ON public.case_calculation_items
FOR EACH ROW EXECUTE FUNCTION public.case_calculation_items_guard();

-- Advogado precisa poder gravar o valor manual (a tabela hoje só permitia leitura)
DROP POLICY IF EXISTS "Org members can update calculation items" ON public.case_calculation_items;
CREATE POLICY "Org members can update calculation items"
ON public.case_calculation_items
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.case_calculations c
  WHERE c.id = case_calculation_items.calculation_id
    AND c.organization_id = public.get_my_organization_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.case_calculations c
  WHERE c.id = case_calculation_items.calculation_id
    AND c.organization_id = public.get_my_organization_id()
));

GRANT SELECT, UPDATE ON public.case_calculation_items TO authenticated;
GRANT ALL ON public.case_calculation_items TO service_role;