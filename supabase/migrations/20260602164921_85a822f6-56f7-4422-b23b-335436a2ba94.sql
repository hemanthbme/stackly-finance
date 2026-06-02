-- Extend invites and members with access_level
ALTER TABLE public.household_invites
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'full'
    CHECK (access_level IN ('full', 'view_only', 'expenses_only'));

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'full'
    CHECK (access_level IN ('full', 'view_only', 'expenses_only'));

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Allow anyone (anon + authenticated) to read invite rows by token.
-- The invite page must work for signed-out visitors.
DROP POLICY IF EXISTS "public read invites" ON public.household_invites;
CREATE POLICY "public read invites"
  ON public.household_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.household_invites TO anon;

-- Preview function: returns minimal invite info even for anon users
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token TEXT)
RETURNS TABLE(
  household_id uuid,
  household_name text,
  access_level text,
  status text,
  expires_at timestamptz,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.name, i.access_level, i.status::text, i.expires_at, i.invited_by
  FROM public.household_invites i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.invite_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- Accept invite: insert membership + mark invite accepted, security definer
CREATE OR REPLACE FUNCTION public.accept_household_invite(_token TEXT, _name TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.household_invites;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to accept invite';
  END IF;

  SELECT * INTO v_invite FROM public.household_invites
  WHERE invite_token = _token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Skip if already a member
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_household_invite(text, text) TO authenticated;

-- Admin helpers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'email') = 'admin@stackly.app', false);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_active_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.created_at, COALESCE(u.last_sign_in_at, u.created_at)
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;