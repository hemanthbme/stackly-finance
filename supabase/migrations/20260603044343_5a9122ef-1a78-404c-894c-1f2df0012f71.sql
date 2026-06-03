CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email') = lower('hemanth.bme@gmail.com'), false);
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.household_goals (
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

CREATE TABLE IF NOT EXISTS public.recurring_entries (
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

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE id = _household_id AND created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_invite_preview(_token TEXT)
RETURNS TABLE(
  household_id uuid, household_name text, access_level text,
  status text, expires_at timestamptz, created_by uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.name, i.access_level, i.status::text, i.expires_at, i.invited_by
  FROM public.household_invites i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.invite_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_household_invite(_token TEXT, _name TEXT)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.household_invites;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO v_invite FROM public.household_invites
  WHERE invite_token = _token AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invite'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = v_invite.household_id AND user_id = auth.uid()
  ) THEN
    UPDATE public.household_invites
      SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
      WHERE id = v_invite.id;
    RETURN NULL;
  END IF;
  INSERT INTO public.household_members
    (household_id, name, user_id, access_level, invited_by, relationship, created_by)
  VALUES
    (v_invite.household_id, _name, auth.uid(), v_invite.access_level,
     v_invite.invited_by, 'member', auth.uid())
  RETURNING id INTO v_member_id;
  UPDATE public.household_invites
    SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    WHERE id = v_invite.id;
  RETURN v_member_id;
END; $$;

DROP POLICY IF EXISTS "members view accounts" ON public.accounts;
CREATE POLICY "members view accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members view snapshots" ON public.weekly_snapshots;
CREATE POLICY "members view snapshots" ON public.weekly_snapshots FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members view budgets" ON public.budgets;
CREATE POLICY "members view budgets" ON public.budgets FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members view their household" ON public.households;
CREATE POLICY "members view their household" ON public.households FOR SELECT TO authenticated USING (public.is_household_member(id));

DROP POLICY IF EXISTS "members view goals" ON public.household_goals;
CREATE POLICY "members view goals" ON public.household_goals FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "owners manage goals" ON public.household_goals;
CREATE POLICY "owners manage goals" ON public.household_goals FOR ALL TO authenticated USING (public.is_household_owner(household_id)) WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "members view recurring" ON public.recurring_entries;
CREATE POLICY "members view recurring" ON public.recurring_entries FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "owners manage recurring" ON public.recurring_entries;
CREATE POLICY "owners manage recurring" ON public.recurring_entries FOR ALL TO authenticated USING (public.is_household_owner(household_id)) WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "members add spending" ON public.spending_entries;
CREATE POLICY "members add spending" ON public.spending_entries FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "members view spending" ON public.spending_entries;
CREATE POLICY "members view spending" ON public.spending_entries FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "users can insert own messages" ON public.support_messages;
CREATE POLICY "users can insert own messages" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can view own messages" ON public.support_messages;
CREATE POLICY "users can view own messages" ON public.support_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;