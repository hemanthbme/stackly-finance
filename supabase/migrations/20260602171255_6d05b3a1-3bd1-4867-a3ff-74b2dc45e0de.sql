-- 1. Accounts
DROP POLICY IF EXISTS "members view accounts" ON public.accounts;
CREATE POLICY "members view accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members add accounts" ON public.accounts;
CREATE POLICY "members add accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "members update accounts" ON public.accounts;
CREATE POLICY "members update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.is_household_owner(household_id)) WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "members delete accounts" ON public.accounts;
CREATE POLICY "members delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.is_household_owner(household_id));

-- 2. Weekly snapshots
DROP POLICY IF EXISTS "members view snapshots" ON public.weekly_snapshots;
CREATE POLICY "members view snapshots" ON public.weekly_snapshots FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members add snapshots" ON public.weekly_snapshots;
CREATE POLICY "members add snapshots" ON public.weekly_snapshots FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "members update own snapshots" ON public.weekly_snapshots;
CREATE POLICY "members update own snapshots" ON public.weekly_snapshots FOR UPDATE TO authenticated USING (public.is_household_member(household_id) AND created_by = auth.uid()) WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "members delete snapshots" ON public.weekly_snapshots;
CREATE POLICY "members delete snapshots" ON public.weekly_snapshots FOR DELETE TO authenticated USING (public.is_household_owner(household_id));

-- 3. Budgets
DROP POLICY IF EXISTS "members view budgets" ON public.budgets;
CREATE POLICY "members view budgets" ON public.budgets FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members manage budgets" ON public.budgets;
CREATE POLICY "members manage budgets" ON public.budgets FOR ALL TO authenticated USING (public.is_household_owner(household_id)) WITH CHECK (public.is_household_owner(household_id));

-- 4. Household members roster
DROP POLICY IF EXISTS "Users can view household members for own household" ON public.household_members;
CREATE POLICY "Users can view household members for own household" ON public.household_members FOR SELECT TO authenticated USING (public.is_household_member(household_id));

-- 5. Households
DROP POLICY IF EXISTS "members view their household" ON public.households;
CREATE POLICY "members view their household" ON public.households FOR SELECT TO authenticated USING (public.is_household_member(id));

-- 6. Goals and recurring entries
DROP POLICY IF EXISTS "members view goals" ON public.household_goals;
CREATE POLICY "members view goals" ON public.household_goals FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members view recurring" ON public.recurring_entries;
CREATE POLICY "members view recurring" ON public.recurring_entries FOR SELECT TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "members add recurring" ON public.recurring_entries;
CREATE POLICY "members add recurring" ON public.recurring_entries FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());

-- 7. Transaction categories
DROP POLICY IF EXISTS "members view categories" ON public.transaction_categories;
CREATE POLICY "members view categories" ON public.transaction_categories FOR SELECT TO authenticated USING (public.is_household_member(household_id));