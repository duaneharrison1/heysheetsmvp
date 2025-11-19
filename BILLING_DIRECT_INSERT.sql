-- ================================================
-- Direct billing data insert with real user ID
-- ================================================
-- Run this in Supabase SQL Editor to insert mock billing data
-- IMPORTANT: Replace 'your-user-id-here' with the actual UUID from your auth.users table

-- First, check your user ID:
-- SELECT id, email FROM auth.users;

-- Then replace the UUID below and run this script

DO $$
DECLARE
  v_user_id UUID := '424ccc7f-b1d4-4f22-b0fb-671733fdfb25'::UUID;  -- REPLACE WITH YOUR ACTUAL USER ID
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User % does not exist', v_user_id;
  END IF;

  -- ================================================
  -- 1. INSERT MOCK SUBSCRIPTION
  -- ================================================
  INSERT INTO public.billing_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    plan_name,
    plan_type,
    status,
    current_period_start,
    current_period_end,
    amount_usd,
    billing_cycle
  ) VALUES (
    v_user_id,
    'sub_test_' || substr(md5(random()::text), 1, 8),
    'cus_test_' || substr(md5(random()::text), 1, 8),
    'Professional Plan',
    'professional',
    'active',
    NOW(),
    NOW() + INTERVAL '30 days',
    29.99,
    'monthly'
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 2. INSERT MOCK PAYMENT METHOD
  -- ================================================
  INSERT INTO public.billing_payment_methods (
    user_id,
    stripe_payment_method_id,
    card_brand,
    card_last4,
    card_exp_month,
    card_exp_year,
    is_default
  ) VALUES (
    v_user_id,
    'pm_test_' || substr(md5(random()::text), 1, 8),
    'Visa',
    '4242',
    12,
    2025,
    true
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 3. INSERT MOCK INVOICES
  -- ================================================
  INSERT INTO public.billing_invoices (
    user_id,
    stripe_invoice_id,
    amount_usd,
    status,
    invoice_date,
    paid_date,
    description
  ) VALUES (
    v_user_id,
    'in_test_' || substr(md5(random()::text), 1, 8),
    29.99,
    'paid',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days',
    'Professional Plan - Monthly Subscription'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.billing_invoices (
    user_id,
    stripe_invoice_id,
    amount_usd,
    status,
    invoice_date,
    paid_date,
    description
  ) VALUES (
    v_user_id,
    'in_test_' || substr(md5(random()::text), 1, 8),
    29.99,
    'paid',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '34 days',
    'Professional Plan - Monthly Subscription'
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 4. INSERT MOCK USAGE
  -- ================================================
  INSERT INTO public.billing_usage (
    user_id,
    period_start,
    period_end,
    stores_count,
    messages_count,
    api_calls_count,
    storage_gb
  ) VALUES (
    v_user_id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    3,
    1250,
    5420,
    2.45
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Mock billing data inserted successfully for user: %', v_user_id;
END $$;
