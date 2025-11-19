# Billing Page Implementation Guide

This guide explains the updated Billing page and the database schema for tracking billing information.

## Overview

The improved Billing page now includes:
- **Subscription Plan Details** - Shows current plan, billing cycle, amount, and renewal date
- **Payment Methods** - Displays saved cards with expiration info
- **Payment History** - View invoices with download capability
- **Confirmations** - Modal dialogs for destructive actions

## Database Schema

Run `BILLING_SETUP.sql` in your Supabase SQL Editor to create the following tables:

### 1. `billing_subscriptions`
Stores subscription information synced from Stripe.

**Key Fields:**
- `user_id` - References auth.users
- `stripe_subscription_id` - Stripe subscription ID (unique)
- `stripe_customer_id` - Stripe customer ID
- `plan_name` - Human-readable plan name
- `plan_type` - free | starter | professional | enterprise
- `status` - active | paused | canceled | past_due
- `current_period_start/end` - Billing period dates
- `cancel_at` - When subscription will be canceled
- `amount_usd` - Monthly/yearly cost
- `billing_cycle` - monthly | yearly

### 2. `billing_payment_methods`
Stores saved payment method information.

**Key Fields:**
- `user_id` - References auth.users
- `stripe_payment_method_id` - Stripe payment method ID (unique)
- `card_brand` - visa, mastercard, amex, etc.
- `card_last4` - Last 4 digits
- `card_exp_month/year` - Expiration date
- `is_default` - Whether this is the default payment method

### 3. `billing_invoices`
Stores invoice/receipt information.

**Key Fields:**
- `user_id` - References auth.users
- `stripe_invoice_id` - Stripe invoice ID (unique)
- `subscription_id` - References billing_subscriptions
- `amount_usd` - Invoice amount
- `status` - draft | open | paid | voided | uncollectible
- `invoice_date` - When invoice was issued
- `paid_date` - When invoice was paid
- `pdf_url` - Link to download invoice PDF

### 4. `billing_usage`
Tracks usage metrics for the billing period.

**Key Fields:**
- `user_id` - References auth.users
- `period_start/end` - Usage period
- `stores_count` - Number of stores
- `messages_count` - Total messages
- `api_calls_count` - API calls made
- `storage_gb` - Storage used

## Frontend Integration

The updated Billing page includes:

### Subscription Plan Card
- Displays current plan details in a grid format
- Shows status badge (Active, Past Due, etc.)
- Shows renewal date and billing cycle
- Warning alert if subscription is scheduled for cancellation
- Action buttons to change plan or cancel

### Payment Methods Card
- Lists all saved payment methods
- Shows card brand, last 4 digits, and expiration
- Displays "Default" badge for default payment method
- Link to manage more methods in Stripe portal

### Payment History Card
- Table of all invoices
- Shows date, description, amount, and status
- Download button for invoice PDFs
- Status badges with appropriate styling

## Edge Function Requirements

You'll need to create/update the following edge functions:

### POST `/functions/v1/invoices`
Fetch invoices for authenticated user from Stripe.

**Response:**
```json
{
  "invoices": [
    {
      "id": "inv-123",
      "stripe_invoice_id": "in_123abc",
      "amount_usd": 29.99,
      "status": "paid",
      "invoice_date": "2024-01-15T00:00:00Z",
      "description": "Plan subscription",
      "pdf_url": "https://..."
    }
  ]
}
```

### Existing Functions to Update
- `/functions/v1/subscription` - Should include `billing_cycle` and `amount_usd`
- `/functions/v1/payment-methods` - Should include `is_default` field

## Setting Up Stripe Webhooks

Configure these webhooks in your Stripe Dashboard:

1. `customer.subscription.created` → Sync to `billing_subscriptions`
2. `customer.subscription.updated` → Update `billing_subscriptions`
3. `customer.subscription.deleted` → Update status to 'canceled'
4. `payment_method.attached` → Sync to `billing_payment_methods`
5. `invoice.created` → Sync to `billing_invoices`
6. `invoice.payment_succeeded` → Update invoice status

## RLS Policies

All billing tables have Row Level Security enabled:
- Users can only view their own billing data
- Service role can manage all data (for webhook processing)

## UI/UX Features

✅ Loading states for all async operations
✅ Modal confirmations for subscription cancellation
✅ Status badges with color coding
✅ Invoice PDF downloads
✅ Responsive table design
✅ Error handling with toast notifications
✅ Proper disabled states during operations

## Future Enhancements

- [ ] Set default payment method
- [ ] Delete payment method
- [ ] Retry failed payments
- [ ] Usage-based billing dashboard
- [ ] Billing alerts for exceeded limits
- [ ] Invoice email forwarding
