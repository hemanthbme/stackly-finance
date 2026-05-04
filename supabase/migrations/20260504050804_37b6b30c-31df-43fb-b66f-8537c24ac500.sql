
-- Budget period
DO $$ BEGIN
  CREATE TYPE budget_period AS ENUM ('daily','weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS period budget_period NOT NULL DEFAULT 'daily';

-- Member roles
DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS role member_role NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Household invites
DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  invited_email text,
  invite_code text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role member_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  status invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners manage invites" ON public.household_invites;
CREATE POLICY "owners manage invites"
  ON public.household_invites
  FOR ALL
  TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id) AND invited_by = auth.uid());

-- Allow any authenticated user to read an invite by token (needed for accept flow)
DROP POLICY IF EXISTS "read invites by token" ON public.household_invites;
CREATE POLICY "read invites by token"
  ON public.household_invites
  FOR SELECT
  TO authenticated
  USING (true);
