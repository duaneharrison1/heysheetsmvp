-- ================================================
-- HeySheets Billing Tables Setup
-- ================================================
-- Run this script in Supabase SQL Editor to add billing-related tables
-- This should be run AFTER the main DATABASE_SETUP.sql
-- ================================================

-- Create billing_subscriptions table
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id TEXT PRIMARY KEY DEFAULT ('sub-' || substr(md5(random()::text), 1, 12)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_name TEXT NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise')) DEFAULT 'free',
  status TEXT CHECK (status IN ('active', 'paused', 'canceled', 'past_due')) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  amount_usd NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create billing_payment_methods table
CREATE TABLE IF NOT EXISTS public.billing_payment_methods (
  id TEXT PRIMARY KEY DEFAULT ('pm-' || substr(md5(random()::text), 1, 12)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create billing_invoices table
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id TEXT PRIMARY KEY DEFAULT ('inv-' || substr(md5(random()::text), 1, 12)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  subscription_id TEXT REFERENCES public.billing_subscriptions(id),
  amount_usd NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK (status IN ('draft', 'open', 'paid', 'voided', 'uncollectible')) DEFAULT 'draft',
  invoice_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create billing_usage table for tracking usage metrics
CREATE TABLE IF NOT EXISTS public.billing_usage (
  id TEXT PRIMARY KEY DEFAULT ('usage-' || substr(md5(random()::text), 1, 12)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stores_count INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  storage_gb NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS billing_subscriptions_user_id_idx ON public.billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_stripe_id_idx ON public.billing_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS billing_payment_methods_user_id_idx ON public.billing_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS billing_invoices_user_id_idx ON public.billing_invoices(user_id);
CREATE INDEX IF NOT EXISTS billing_invoices_subscription_id_idx ON public.billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS billing_usage_user_id_idx ON public.billing_usage(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON public.billing_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for billing_payment_methods
DROP POLICY IF EXISTS "Users can view their own payment methods" ON public.billing_payment_methods;
CREATE POLICY "Users can view their own payment methods"
  ON public.billing_payment_methods
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for billing_invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.billing_invoices;
CREATE POLICY "Users can view their own invoices"
  ON public.billing_invoices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for billing_usage
DROP POLICY IF EXISTS "Users can view their own usage" ON public.billing_usage;
CREATE POLICY "Users can view their own usage"
  ON public.billing_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create trigger functions for updated_at
CREATE OR REPLACE FUNCTION public.handle_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS set_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER set_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_billing_updated_at();

DROP TRIGGER IF EXISTS set_billing_payment_methods_updated_at ON public.billing_payment_methods;
CREATE TRIGGER set_billing_payment_methods_updated_at
  BEFORE UPDATE ON public.billing_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_billing_updated_at();

DROP TRIGGER IF EXISTS set_billing_invoices_updated_at ON public.billing_invoices;
CREATE TRIGGER set_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_billing_updated_at();

DROP TRIGGER IF EXISTS set_billing_usage_updated_at ON public.billing_usage;
CREATE TRIGGER set_billing_usage_updated_at
  BEFORE UPDATE ON public.billing_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_billing_updated_at();

-- Grant permissions
GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT SELECT ON public.billing_payment_methods TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT SELECT ON public.billing_usage TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
GRANT ALL ON public.billing_payment_methods TO service_role;
GRANT ALL ON public.billing_invoices TO service_role;
GRANT ALL ON public.billing_usage TO service_role;

-- ================================================
-- Success!
-- ================================================
-- Billing tables are now ready!
-- Your Stripe webhooks can now sync data to these tables.
