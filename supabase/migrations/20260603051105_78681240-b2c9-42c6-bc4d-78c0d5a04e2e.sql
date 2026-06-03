REVOKE SELECT ON public.spending_entries FROM authenticated;
REVOKE SELECT ON public.weekly_snapshots FROM authenticated;
REVOKE SELECT ON public.accounts FROM authenticated;
REVOKE SELECT ON public.budgets FROM authenticated;

GRANT SELECT ON public.spending_entries TO authenticated;
GRANT SELECT ON public.weekly_snapshots TO authenticated;
GRANT SELECT ON public.accounts TO authenticated;
GRANT SELECT ON public.budgets TO authenticated;

ALTER TABLE public.spending_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.budgets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.households FORCE ROW LEVEL SECURITY;
ALTER TABLE public.household_members FORCE ROW LEVEL SECURITY;