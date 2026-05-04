
-- ENUMS
CREATE TYPE account_category AS ENUM ('checking','savings','credit_card','retirement_401k','brokerage','ira','car_loan','mortgage','student_loan','personal_loan','other_asset','other_liability');
CREATE TYPE ownership_type AS ENUM ('individual','joint');
CREATE TYPE budget_type AS ENUM ('individual','combined');
CREATE TYPE spending_category AS ENUM ('food','coffee_snacks','groceries','gas_transportation','shopping','entertainment','bills','travel','other');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HOUSEHOLDS
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all households" ON public.households FOR ALL
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Helper: is user owner of a household
CREATE OR REPLACE FUNCTION public.is_household_owner(_household_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.households WHERE id = _household_id AND created_by = auth.uid());
$$;

-- HOUSEHOLD MEMBERS
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  color TEXT DEFAULT '#4f46e5',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members in own household" ON public.household_members FOR ALL
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- ACCOUNTS
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category account_category NOT NULL,
  ownership ownership_type NOT NULL DEFAULT 'individual',
  institution TEXT,
  include_in_net_worth BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts in own household" ON public.accounts FOR ALL
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- WEEKLY SNAPSHOTS
CREATE TABLE public.weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  contribution NUMERIC(14,2) DEFAULT 0,
  payment NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, week_ending)
);
ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots in own household" ON public.weekly_snapshots FOR ALL
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- BUDGETS
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  budget_type budget_type NOT NULL,
  member_id UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  daily_limit NUMERIC(12,2) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets in own household" ON public.budgets FOR ALL
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- SPENDING ENTRIES
CREATE TABLE public.spending_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  category spending_category NOT NULL DEFAULT 'other',
  payment_method TEXT,
  notes TEXT,
  spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spending_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spending in own household" ON public.spending_entries FOR ALL
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

CREATE INDEX idx_snapshots_household_week ON public.weekly_snapshots(household_id, week_ending);
CREATE INDEX idx_spending_household_date ON public.spending_entries(household_id, spent_at);
CREATE INDEX idx_accounts_household ON public.accounts(household_id);
