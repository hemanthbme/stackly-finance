
DO $$ BEGIN
  CREATE TYPE public.txn_category_type AS ENUM ('expense','income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  color text DEFAULT '#4f46e5',
  category_type public.txn_category_type NOT NULL DEFAULT 'expense',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view categories" ON public.transaction_categories;
CREATE POLICY "members view categories" ON public.transaction_categories
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "owners manage categories" ON public.transaction_categories;
CREATE POLICY "owners manage categories" ON public.transaction_categories
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id) AND created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_txn_categories_household ON public.transaction_categories(household_id);
