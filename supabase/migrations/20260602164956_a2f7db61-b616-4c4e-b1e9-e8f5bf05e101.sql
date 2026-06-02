CREATE OR REPLACE FUNCTION public.admin_user_summary()
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_active_at timestamptz,
  household_id uuid,
  household_name text,
  member_count bigint,
  member_names text
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
    SELECT
      u.id,
      u.email::text,
      u.created_at,
      COALESCE(u.last_sign_in_at, u.created_at),
      h.id,
      h.name,
      COALESCE((SELECT count(*) FROM public.household_members hm WHERE hm.household_id = h.id), 0),
      COALESCE((SELECT string_agg(hm.name, ', ') FROM public.household_members hm WHERE hm.household_id = h.id), '')
    FROM auth.users u
    LEFT JOIN public.households h ON h.created_by = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;