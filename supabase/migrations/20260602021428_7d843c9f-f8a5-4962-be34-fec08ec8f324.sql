
-- 1) Fix household_invites SELECT exposure
DROP POLICY IF EXISTS "read invites by token" ON public.household_invites;

CREATE POLICY "owners and invitees read invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  public.is_household_owner(household_id)
  OR invited_email = (auth.jwt() ->> 'email')
  OR accepted_by = auth.uid()
);

-- 2) Allow household members access to shared household data
-- households: members can SELECT their households
CREATE POLICY "members view their household"
ON public.households
FOR SELECT
TO authenticated
USING (public.is_household_member(id));

-- accounts
CREATE POLICY "members view accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_household_member(household_id));

-- budgets
CREATE POLICY "members view budgets"
ON public.budgets
FOR SELECT
TO authenticated
USING (public.is_household_member(household_id));

-- spending_entries: members can view and add their own spending
CREATE POLICY "members view spending"
ON public.spending_entries
FOR SELECT
TO authenticated
USING (public.is_household_member(household_id));

CREATE POLICY "members add spending"
ON public.spending_entries
FOR INSERT
TO authenticated
WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

CREATE POLICY "members update own spending"
ON public.spending_entries
FOR UPDATE
TO authenticated
USING (public.is_household_member(household_id) AND created_by = auth.uid())
WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

CREATE POLICY "members delete own spending"
ON public.spending_entries
FOR DELETE
TO authenticated
USING (public.is_household_member(household_id) AND created_by = auth.uid());

-- weekly_snapshots: members can view, add, and edit
CREATE POLICY "members view snapshots"
ON public.weekly_snapshots
FOR SELECT
TO authenticated
USING (public.is_household_member(household_id));

CREATE POLICY "members add snapshots"
ON public.weekly_snapshots
FOR INSERT
TO authenticated
WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

CREATE POLICY "members update own snapshots"
ON public.weekly_snapshots
FOR UPDATE
TO authenticated
USING (public.is_household_member(household_id) AND created_by = auth.uid())
WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

-- 3) Lock down SECURITY DEFINER helper functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;

-- handle_new_user is invoked by an auth trigger; remove public/anon execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
