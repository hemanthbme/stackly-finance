CREATE OR REPLACE FUNCTION public.seed_demo_household()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := 'ba7b53da-61a4-4c71-ae6a-bb23c521236e';
  v_hh uuid;
  v_alex uuid;
  v_sam uuid;
  v_sunday date := CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE))::int);
  v_start date := (date_trunc('month', CURRENT_DATE) - interval '6 months')::date;
  v_acc record;
  v_accid uuid;
  v_i int;
  v_bal numeric;
  v_d date;
  v_n int;
  v_k int;
  v_cat spending_category;
  v_amt numeric;
  v_note text;
  v_pm text;
  v_mem uuid;
  v_r numeric;
  v_weekend boolean;
  v_spend_count int := 0;
  v_snap_count int := 0;
  v_months int;
  v_total numeric;
BEGIN
  DELETE FROM public.spending_entries WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.weekly_snapshots WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.recurring_entries WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.budgets WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.household_goals WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.transaction_categories WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.accounts WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.household_members WHERE household_id IN (SELECT id FROM public.households WHERE created_by = v_uid);
  DELETE FROM public.households WHERE created_by = v_uid;

  UPDATE public.profiles SET user_timezone = 'America/Los_Angeles', onboarding_completed = true WHERE id = v_uid;

  INSERT INTO public.households (name, created_by) VALUES ('The Rivera Household', v_uid) RETURNING id INTO v_hh;

  INSERT INTO public.household_members (household_id, name, relationship, color, created_by, role, user_id, access_level)
  VALUES (v_hh, 'Alex', 'self', '#4f46e5', v_uid, 'owner', v_uid, 'full') RETURNING id INTO v_alex;
  INSERT INTO public.household_members (household_id, name, relationship, color, created_by, role, user_id, access_level)
  VALUES (v_hh, 'Sam', 'partner', '#ec4899', v_uid, 'member', NULL, 'full') RETURNING id INTO v_sam;

  FOR v_acc IN
    SELECT * FROM (VALUES
      ('Alex Checking','checking','individual','Alex','Chase',4200,5850,0,0),
      ('Sam Checking','checking','individual','Sam','Wells Fargo',3100,4400,0,0),
      ('Joint Savings','savings','joint',NULL,'Ally',18500,26400,500,0),
      ('Emergency Fund','savings','joint',NULL,'Ally',12000,15000,115,0),
      ('Chase Sapphire','credit_card','joint',NULL,'Chase',6800,2150,0,180),
      ('Alex 401(k)','retirement_401k','individual','Alex','Fidelity',84000,98500,650,0),
      ('Sam 401(k)','retirement_401k','individual','Sam','Vanguard',61000,71200,480,0),
      ('Fidelity Brokerage','brokerage','joint',NULL,'Fidelity',22400,28900,300,0),
      ('Home Value','other_asset','joint',NULL,NULL,628000,634000,0,0),
      ('Car Loan','car_loan','joint',NULL,'Toyota Financial',19600,12400,0,275),
      ('Mortgage','mortgage','joint',NULL,'Wells Fargo',412000,402300,0,1950)
    ) AS t(name, cat, own, mem, inst, old_bal, new_bal, contrib, pay)
  LOOP
    INSERT INTO public.accounts (household_id, member_id, name, category, ownership, institution, include_in_net_worth, is_active, created_by)
    VALUES (v_hh,
            CASE WHEN v_acc.mem = 'Alex' THEN v_alex WHEN v_acc.mem = 'Sam' THEN v_sam ELSE NULL END,
            v_acc.name, v_acc.cat::account_category, v_acc.own::ownership_type, v_acc.inst, true, true, v_uid)
    RETURNING id INTO v_accid;

    FOR v_i IN 0..25 LOOP
      v_bal := v_acc.new_bal + (v_acc.old_bal - v_acc.new_bal) * (v_i::numeric / 25);
      IF v_i > 0 AND v_i < 25 THEN
        v_bal := v_bal * (1 + (random() - 0.5) * 0.02);
      END IF;
      INSERT INTO public.weekly_snapshots (household_id, account_id, week_ending, balance, contribution, payment, created_by)
      VALUES (v_hh, v_accid, v_sunday - (v_i * 7), round(v_bal, 2),
              NULLIF(v_acc.contrib, 0), NULLIF(v_acc.pay, 0), v_uid);
      v_snap_count := v_snap_count + 1;
    END LOOP;
  END LOOP;

  v_d := v_start;
  WHILE v_d <= CURRENT_DATE LOOP
    v_weekend := EXTRACT(DOW FROM v_d)::int IN (0, 5, 6);
    IF v_weekend THEN
      v_n := 2 + floor(random() * 2)::int;
    ELSE
      v_n := floor(random() * 2.2)::int;
    END IF;
    FOR v_k IN 1..GREATEST(v_n, 0) LOOP
      v_r := random();
      IF v_r < 0.18 THEN
        v_cat := 'coffee_snacks'; v_amt := 4 + random() * 8;
        v_note := (ARRAY['Blue Bottle','morning coffee','bagel run','Starbucks'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.38 THEN
        v_cat := 'groceries'; v_amt := 40 + random() * 140;
        v_note := (ARRAY['Trader Joe''s','Safeway','Costco run','farmers market'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.60 THEN
        v_cat := 'food'; v_amt := 15 + random() * 80;
        v_note := (ARRAY['Friday dinner out','lunch with team','takeout','brunch'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.70 THEN
        v_cat := 'gas_transportation'; v_amt := 30 + random() * 40;
        v_note := (ARRAY['gas','Shell','parking','BART'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.82 THEN
        v_cat := 'shopping'; v_amt := 20 + random() * 230;
        v_note := (ARRAY['Target','Amazon order','new shoes','home stuff'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.92 THEN
        v_cat := 'entertainment'; v_amt := 15 + random() * 105;
        v_note := (ARRAY['movie night','concert tickets','bowling','museum'])[1 + floor(random() * 4)];
      ELSIF v_r < 0.98 THEN
        v_cat := 'bills'; v_amt := 45 + random() * 355;
        v_note := (ARRAY['utilities','phone bill','internet','insurance'])[1 + floor(random() * 4)];
      ELSE
        v_cat := 'travel'; v_amt := 200 + random() * 700;
        v_note := (ARRAY['flights','hotel','weekend trip','rental car'])[1 + floor(random() * 4)];
      END IF;

      IF v_weekend THEN v_amt := v_amt * 1.15; END IF;

      v_pm := (ARRAY['Chase Sapphire','Alex Checking','Sam Checking','Joint Savings'])[1 + floor(random() * 4)];
      v_mem := CASE WHEN random() < 0.5 THEN v_alex ELSE v_sam END;

      INSERT INTO public.spending_entries (household_id, member_id, amount, category, payment_method, notes, spent_at, spent_local_date, user_timezone, created_by)
      VALUES (v_hh, v_mem, round(v_amt, 2), v_cat, v_pm, v_note, v_d, v_d, 'America/Los_Angeles', v_uid);
      v_spend_count := v_spend_count + 1;
    END LOOP;
    v_d := v_d + 1;
  END LOOP;

  FOR v_i IN 0..6 LOOP
    v_d := (date_trunc('month', CURRENT_DATE) - make_interval(months => v_i))::date + 2;
    IF v_d > CURRENT_DATE THEN v_d := CURRENT_DATE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.spending_entries
      WHERE household_id = v_hh AND to_char(spent_at, 'YYYY-MM') = to_char(v_d, 'YYYY-MM')
    ) THEN
      INSERT INTO public.spending_entries (household_id, member_id, amount, category, payment_method, notes, spent_at, spent_local_date, user_timezone, created_by)
      VALUES (v_hh, v_alex, 82.40, 'groceries', 'Chase Sapphire', 'Trader Joe''s', v_d, v_d, 'America/Los_Angeles', v_uid);
      v_spend_count := v_spend_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.recurring_entries (household_id, label, amount, category, member_id, is_active, created_by) VALUES
    (v_hh, 'Mortgage payment', 1950, 'bills', NULL, true, v_uid),
    (v_hh, 'Car payment', 275, 'bills', NULL, true, v_uid),
    (v_hh, 'Auto & home insurance', 210, 'bills', NULL, true, v_uid),
    (v_hh, 'Internet', 75, 'bills', NULL, true, v_uid),
    (v_hh, 'Phone plan', 95, 'bills', NULL, true, v_uid),
    (v_hh, 'Streaming services', 45, 'entertainment', NULL, true, v_uid);

  INSERT INTO public.budgets (household_id, name, budget_type, member_id, daily_limit, period, start_date, is_active, created_by)
  VALUES (v_hh, 'Household daily budget', 'combined', NULL, round(4400::numeric / 31, 2), 'daily', v_start, true, v_uid);

  INSERT INTO public.household_goals (household_id, label, type, target, created_by) VALUES
    (v_hh, 'Emergency fund to $25k', 'savings', 25000, v_uid),
    (v_hh, 'Pay down total debt below $400k', 'debt_payoff', 400000, v_uid);

  SELECT count(DISTINCT to_char(spent_at, 'YYYY-MM')) INTO v_months FROM public.spending_entries WHERE household_id = v_hh;
  SELECT coalesce(sum(amount), 0) INTO v_total FROM public.spending_entries WHERE household_id = v_hh;

  RETURN format('Demo household %s seeded: 11 accounts, %s snapshots, %s spending entries across %s months, avg monthly spend %s',
                v_hh, v_snap_count, v_spend_count, v_months, round(v_total / GREATEST(v_months, 1), 2));
END;
$fn$;

REVOKE ALL ON FUNCTION public.seed_demo_household() FROM public;
REVOKE ALL ON FUNCTION public.seed_demo_household() FROM anon;
REVOKE ALL ON FUNCTION public.seed_demo_household() FROM authenticated;