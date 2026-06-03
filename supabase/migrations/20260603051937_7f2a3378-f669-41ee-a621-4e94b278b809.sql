CREATE POLICY "members update own recurring"
ON public.recurring_entries
FOR UPDATE
TO authenticated
USING (is_household_member(household_id) AND created_by = auth.uid())
WITH CHECK (is_household_member(household_id) AND created_by = auth.uid());

CREATE POLICY "members delete own recurring"
ON public.recurring_entries
FOR DELETE
TO authenticated
USING (is_household_member(household_id) AND created_by = auth.uid());