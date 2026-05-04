
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "members in own household" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert household members for own household" ON public.household_members;
DROP POLICY IF EXISTS "Users can view household members for own household" ON public.household_members;
DROP POLICY IF EXISTS "Users can update household members for own household" ON public.household_members;
DROP POLICY IF EXISTS "Users can delete household members for own household" ON public.household_members;

CREATE POLICY "Users can view household members for own household"
ON public.household_members FOR SELECT TO authenticated
USING (public.is_household_owner(household_id));

CREATE POLICY "Users can insert household members for own household"
ON public.household_members FOR INSERT TO authenticated
WITH CHECK (public.is_household_owner(household_id) AND created_by = auth.uid());

CREATE POLICY "Users can update household members for own household"
ON public.household_members FOR UPDATE TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));

CREATE POLICY "Users can delete household members for own household"
ON public.household_members FOR DELETE TO authenticated
USING (public.is_household_owner(household_id));

-- Re-scope other household-scoped tables to authenticated role for clarity
DROP POLICY IF EXISTS "accounts in own household" ON public.accounts;
CREATE POLICY "accounts in own household" ON public.accounts
FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "snapshots in own household" ON public.weekly_snapshots;
CREATE POLICY "snapshots in own household" ON public.weekly_snapshots
FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "budgets in own household" ON public.budgets;
CREATE POLICY "budgets in own household" ON public.budgets
FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));

DROP POLICY IF EXISTS "spending in own household" ON public.spending_entries;
CREATE POLICY "spending in own household" ON public.spending_entries
FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));
