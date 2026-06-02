CREATE TABLE public.household_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('net_worth', 'savings', 'debt_payoff')),
  target NUMERIC(14,2) NOT NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_goals TO authenticated;
GRANT ALL ON public.household_goals TO service_role;

ALTER TABLE public.household_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage goals"
  ON public.household_goals
  FOR ALL
  TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

CREATE POLICY "members view goals"
  ON public.household_goals
  FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id));

CREATE INDEX idx_goals_household ON public.household_goals(household_id);