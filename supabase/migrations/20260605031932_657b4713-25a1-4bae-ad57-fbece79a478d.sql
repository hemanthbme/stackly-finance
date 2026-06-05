DROP FUNCTION IF EXISTS public.admin_user_summary();

CREATE OR REPLACE FUNCTION public.admin_user_summary()
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamp with time zone,
  last_active_at timestamp with time zone,
  household_id uuid,
  household_name text,
  member_count bigint,
  member_names text,
  account_count bigint,
  snapshot_count bigint,
  spending_30d bigint,
  spending_total bigint,
  last_entry_at timestamp with time zone,
  activity_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id AS user_id,
      u.email::text AS email,
      u.created_at AS signed_up_at,
      COALESCE(u.last_sign_in_at, u.created_at) AS last_active_at,
      h.id AS household_id,
      h.name AS household_name
    FROM auth.users u
    LEFT JOIN public.households h ON h.created_by = u.id
  ),
  agg AS (
    SELECT
      b.*,
      COALESCE((SELECT count(*) FROM public.household_members hm WHERE hm.household_id = b.household_id), 0) AS member_count,
      COALESCE((SELECT string_agg(hm.name, ', ') FROM public.household_members hm WHERE hm.household_id = b.household_id), '') AS member_names,
      COALESCE((SELECT count(*) FROM public.accounts a WHERE a.household_id = b.household_id AND a.is_active), 0) AS account_count,
      COALESCE((SELECT count(*) FROM public.weekly_snapshots w WHERE w.household_id = b.household_id), 0) AS snapshot_count,
      COALESCE((SELECT count(*) FROM public.spending_entries s WHERE s.household_id = b.household_id AND s.created_at >= now() - interval '30 days'), 0) AS spending_30d,
      COALESCE((SELECT count(*) FROM public.spending_entries s WHERE s.household_id = b.household_id), 0) AS spending_total,
      (SELECT max(s.created_at) FROM public.spending_entries s WHERE s.household_id = b.household_id) AS last_entry_at
    FROM base b
  )
  SELECT
    agg.user_id,
    agg.email,
    agg.signed_up_at,
    agg.last_active_at,
    agg.household_id,
    agg.household_name,
    agg.member_count,
    agg.member_names,
    agg.account_count,
    agg.snapshot_count,
    agg.spending_30d,
    agg.spending_total,
    agg.last_entry_at,
    LEAST(
      100,
      (
        CASE
          WHEN GREATEST(agg.last_active_at, COALESCE(agg.last_entry_at, agg.last_active_at)) >= now() - interval '1 day'  THEN 60
          WHEN GREATEST(agg.last_active_at, COALESCE(agg.last_entry_at, agg.last_active_at)) >= now() - interval '7 days' THEN 45
          WHEN GREATEST(agg.last_active_at, COALESCE(agg.last_entry_at, agg.last_active_at)) >= now() - interval '30 days' THEN 25
          WHEN GREATEST(agg.last_active_at, COALESCE(agg.last_entry_at, agg.last_active_at)) >= now() - interval '90 days' THEN 10
          ELSE 0
        END
      )
      + LEAST(40, agg.spending_30d::int * 2)
    )::int AS activity_score
  FROM agg
  ORDER BY agg.signed_up_at DESC;
END;
$$;