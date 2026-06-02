CREATE TABLE public.recurring_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  member_id UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_entries TO authenticated;
GRANT ALL ON public.recurring_entries TO service_role;

ALTER TABLE public.recurring_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage recurring"
  ON public.recurring_entries
  FOR ALL
  TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

CREATE POLICY "members view recurring"
  ON public.recurring_entries
  FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "members add recurring"
  ON public.recurring_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

CREATE INDEX idx_recurring_household ON public.recurring_entries(household_id);