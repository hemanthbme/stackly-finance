-- 1) Allow household members to read connected_accounts (balances), like other financial tables
CREATE POLICY "members view connected accounts"
ON public.connected_accounts
FOR SELECT
TO authenticated
USING (public.is_household_member(household_id));

-- 2) Lock down Plaid access_token_ref at the column level.
--    Revoke from authenticated (and anon, defensively). Service role retains full access.
REVOKE SELECT (access_token_ref) ON public.connected_institutions FROM authenticated;
REVOKE SELECT (access_token_ref) ON public.connected_institutions FROM anon;
REVOKE UPDATE (access_token_ref) ON public.connected_institutions FROM authenticated;
REVOKE UPDATE (access_token_ref) ON public.connected_institutions FROM anon;

-- Re-grant SELECT on all other columns explicitly so owners can still read the rest of the row.
GRANT SELECT (
  id,
  institution_name,
  institution_id,
  provider,
  status,
  last_synced_at,
  household_id,
  created_by,
  created_at
) ON public.connected_institutions TO authenticated;

GRANT UPDATE (
  institution_name,
  status,
  last_synced_at
) ON public.connected_institutions TO authenticated;