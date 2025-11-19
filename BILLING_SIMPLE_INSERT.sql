-- ================================================
-- SIMPLE BILLING MOCK DATA INSERT
-- ================================================
-- This is a simpler version - just copy/paste and run
-- No need for PL/pgSQL or auth.uid()
--
-- STEP 1: Get your user ID by running this first:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--
-- STEP 2: Copy the UUID
--
-- STEP 3: Replace 'YOUR_USER_UUID_HERE' below with your actual UUID
--
-- STEP 4: Run the entire script
-- ================================================

-- REPLACE THIS WITH YOUR ACTUAL USER UUID
-- Example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
-- Find it: SELECT id FROM auth.users LIMIT 1;

-- Insert subscription
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
  'YOUR_USER_UUID_HERE',
  'sub_mock_test001',
  'cus_mock_test001',
  'Professional Plan',
  'professional',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days',
  29.99,
  'monthly'
);

-- Insert payment method
INSERT INTO public.billing_payment_methods (
  user_id,
  stripe_payment_method_id,
  card_brand,
  card_last4,
  card_exp_month,
  card_exp_year,
  is_default
) VALUES (
  'YOUR_USER_UUID_HERE',
  'pm_mock_test001',
  'Visa',
  '4242',
  12,
  2025,
  true
);

-- Insert invoice 1 (current month)
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
  'YOUR_USER_UUID_HERE',
  'in_mock_test001',
  29.99,
  'paid',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '4 days',
  'Professional Plan - Monthly Subscription',
  NULL
);

-- Insert invoice 2 (previous month)
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
  'YOUR_USER_UUID_HERE',
  'in_mock_test002',
  29.99,
  'paid',
  NOW() - INTERVAL '35 days',
  NOW() - INTERVAL '34 days',
  'Professional Plan - Monthly Subscription',
  NULL
);

-- Insert usage data
INSERT INTO public.billing_usage (
  user_id,
  period_start,
  period_end,
  stores_count,
  messages_count,
  api_calls_count,
  storage_gb
) VALUES (
  'YOUR_USER_UUID_HERE',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  3,
  1250,
  5420,
  2.45
);

-- ================================================
-- VERIFY DATA
-- ================================================
-- After inserting, run these to check:

-- SELECT * FROM public.billing_subscriptions WHERE user_id = 'YOUR_USER_UUID_HERE';
-- SELECT * FROM public.billing_payment_methods WHERE user_id = 'YOUR_USER_UUID_HERE';
-- SELECT * FROM public.billing_invoices WHERE user_id = 'YOUR_USER_UUID_HERE';
-- SELECT * FROM public.billing_usage WHERE user_id = 'YOUR_USER_UUID_HERE';
