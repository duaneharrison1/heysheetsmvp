-- ================================================
-- BILLING MOCK DATA - FOR TESTING ONLY
-- ================================================
-- This file contains mock data to test the billing page
-- REPLACE WITH REAL STRIPE DATA when integration is complete
--
-- To use:
-- 1. Get your user_id from auth.users table
-- 2. Replace 'YOUR_USER_ID' with your actual UUID
-- 3. Run this in Supabase SQL Editor
--
-- To reset: Delete data from these tables and run again
-- ================================================

-- IMPORTANT: Replace 'YOUR_USER_ID' with your actual user UUID
-- Example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

DO $$
DECLARE
  v_user_id UUID;
  v_sub_id TEXT;
BEGIN
  -- Get the current authenticated user's ID
  -- If no user, this won't insert anything
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user found. Please sign in and run this again.';
    RETURN;
  END IF;

  -- ================================================
  -- 1. INSERT MOCK SUBSCRIPTION
  -- ================================================
  -- Replace these fields with real Stripe data when integrated:
  -- - stripe_subscription_id → from Stripe API
  -- - stripe_customer_id → from Stripe API
  -- - plan_name → from Stripe product name
  -- - amount_usd → from Stripe price
  -- - current_period_start/end → from Stripe subscription dates
  
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
    'sub_mock_' || substr(md5(random()::text), 1, 8),  -- Replace with Stripe sub ID
    'cus_mock_' || substr(md5(random()::text), 1, 8),  -- Replace with Stripe customer ID
    'Professional Plan',  -- Replace with actual plan name
    'professional',       -- Replace with actual plan type
    'active',            -- Replace with actual status
    NOW(),               -- Will be replaced by Stripe webhook
    NOW() + INTERVAL '30 days',  -- Will be replaced by Stripe webhook
    29.99,               -- Replace with actual amount
    'monthly'            -- Replace with actual cycle
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 2. INSERT MOCK PAYMENT METHOD
  -- ================================================
  -- Replace these fields with real Stripe data when integrated:
  -- - stripe_payment_method_id → from Stripe API
  -- - card_brand → from Stripe card brand
  -- - card_last4 → from Stripe card last4
  -- - card_exp_month/year → from Stripe card expiry
  
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
    'pm_mock_' || substr(md5(random()::text), 1, 8),  -- Replace with Stripe payment method ID
    'Visa',      -- Replace with actual card brand
    '4242',      -- Replace with actual last 4 digits
    12,          -- Replace with actual expiration month
    2025,        -- Replace with actual expiration year
    true         -- true if this is the default card
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 3. INSERT MOCK INVOICES
  -- ================================================
  -- Replace these fields with real Stripe data when integrated:
  -- - stripe_invoice_id → from Stripe API
  -- - amount_usd → from Stripe invoice amount
  -- - status → from Stripe invoice status
  -- - invoice_date → from Stripe invoice creation date
  -- - paid_date → from Stripe invoice paid date
  -- - description → from Stripe line items
  -- - pdf_url → from Stripe invoice.pdf_url
  
  -- Current month (paid)
  INSERT INTO public.billing_invoices (
    user_id,
    stripe_invoice_id,
    amount_usd,
    status,
    invoice_date,
    paid_date,
    description,
    pdf_url
  ) VALUES (
    v_user_id,
    'in_mock_' || substr(md5(random()::text), 1, 8),  -- Replace with Stripe invoice ID
    29.99,
    'paid',
    NOW() - INTERVAL '5 days',  -- Will be replaced by Stripe webhook
    NOW() - INTERVAL '4 days',  -- Will be replaced by Stripe webhook
    'Professional Plan - Monthly Subscription',
    NULL  -- Will be replaced with Stripe PDF URL
  ) ON CONFLICT DO NOTHING;

  -- Previous month (paid)
  INSERT INTO public.billing_invoices (
    user_id,
    stripe_invoice_id,
    amount_usd,
    status,
    invoice_date,
    paid_date,
    description,
    pdf_url
  ) VALUES (
    v_user_id,
    'in_mock_' || substr(md5(random()::text), 1, 8),
    29.99,
    'paid',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '34 days',
    'Professional Plan - Monthly Subscription',
    NULL
  ) ON CONFLICT DO NOTHING;

  -- ================================================
  -- 4. INSERT MOCK USAGE
  -- ================================================
  -- Replace these fields with real usage data when integrated:
  -- - stores_count → count from stores table
  -- - messages_count → count from messages table
  -- - api_calls_count → count from logs
  -- - storage_gb → calculated from files
  
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
    3,      -- Replace with actual store count
    1250,   -- Replace with actual message count
    5420,   -- Replace with actual API call count
    2.45    -- Replace with actual storage used
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Mock billing data inserted for user: %', v_user_id;
END $$;

-- ================================================
-- Verify the data was inserted
-- ================================================
-- SELECT 'Subscriptions' as table_name, COUNT(*) as count FROM public.billing_subscriptions
-- UNION ALL
-- SELECT 'Payment Methods', COUNT(*) FROM public.billing_payment_methods
-- UNION ALL
-- SELECT 'Invoices', COUNT(*) FROM public.billing_invoices
-- UNION ALL
-- SELECT 'Usage', COUNT(*) FROM public.billing_usage;
