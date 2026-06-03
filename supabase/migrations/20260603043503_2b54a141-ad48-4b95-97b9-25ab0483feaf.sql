-- 1. Prevent Plaid access tokens from being readable by clients
REVOKE SELECT (access_token_ref) ON public.connected_institutions FROM anon, authenticated;

-- 2. Ensure support_messages.user_id is always set so RLS doesn't silently hide rows
ALTER TABLE public.support_messages
  ALTER COLUMN user_id SET DEFAULT auth.uid();

UPDATE public.support_messages SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
  WHERE user_id IS NULL;

ALTER TABLE public.support_messages
  ALTER COLUMN user_id SET NOT NULL;
