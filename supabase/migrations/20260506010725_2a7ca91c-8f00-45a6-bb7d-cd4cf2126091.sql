
-- 1. Profiles preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'MM/DD/YYYY',
  ADD COLUMN IF NOT EXISTS week_start text DEFAULT 'sunday',
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system';

-- 2. Spending entries timezone fields
ALTER TABLE public.spending_entries
  ADD COLUMN IF NOT EXISTS spent_local_date date,
  ADD COLUMN IF NOT EXISTS user_timezone text;

-- Backfill: assume spent_at is the local date already
UPDATE public.spending_entries
   SET spent_local_date = spent_at
 WHERE spent_local_date IS NULL;

ALTER TABLE public.spending_entries
  ALTER COLUMN spent_local_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS spending_entries_local_date_idx
  ON public.spending_entries (household_id, spent_local_date);

-- 3. is_household_member helper
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
     WHERE household_id = _household_id
       AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.households
     WHERE id = _household_id
       AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;

-- Allow members to view their household roster
DROP POLICY IF EXISTS "Users can view household members for own household" ON public.household_members;
CREATE POLICY "Users can view household members for own household"
ON public.household_members FOR SELECT TO authenticated
USING (public.is_household_member(household_id));

-- 4. Connected institutions + accounts (Plaid-ready scaffold)
CREATE TABLE IF NOT EXISTS public.connected_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'plaid',
  institution_name text NOT NULL,
  institution_id text,
  status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamptz,
  -- access_token intentionally nullable; will be encrypted server-side later
  access_token_ref text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institutions in own household"
ON public.connected_institutions FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));

CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.connected_institutions(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  external_account_id text,
  name text NOT NULL,
  type text,
  subtype text,
  mask text,
  current_balance numeric DEFAULT 0,
  available_balance numeric,
  currency text DEFAULT 'USD',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connected accounts in own household"
ON public.connected_accounts FOR ALL TO authenticated
USING (public.is_household_owner(household_id))
WITH CHECK (public.is_household_owner(household_id));
