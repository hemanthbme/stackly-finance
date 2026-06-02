-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions,
-- then grant only to authenticated (and service_role) as needed.

-- is_household_owner
REVOKE EXECUTE ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated, service_role;

-- is_household_member
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated, service_role;

-- is_admin
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- admin_get_users
REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated, service_role;

-- admin_user_summary
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated, service_role;

-- accept_household_invite (requires auth.uid())
REVOKE EXECUTE ON FUNCTION public.accept_household_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(text, text) TO authenticated, service_role;

-- get_invite_preview (used on invite landing page; requires sign-in to accept anyway)
REVOKE EXECUTE ON FUNCTION public.get_invite_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO authenticated, service_role;

-- handle_new_user is an auth trigger function; restrict from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;