# Mailjet Email Integration Guide

This guide explains how to set up and use the Mailjet email integration for HeySheets.

## Overview

The Mailjet integration provides:
- Automatic syncing of new user signups to Mailjet contact lists
- Admin interface to manage contact lists and send email campaigns
- API endpoint for programmatic email operations

## Setup

### 1. Environment Variables

Add the following environment variables to your Supabase Edge Functions:

```bash
# Required - Get from Mailjet dashboard (API Keys section)
MAILJET_API_KEY=your_api_key
MAILJET_SECRET_KEY=your_secret_key

# Optional - Default sender for emails
MAILJET_SENDER_EMAIL=noreply@heysheets.com
MAILJET_SENDER_NAME=HeySheets
```

### 2. Deploy Edge Function

Deploy the Mailjet edge function:

```bash
supabase functions deploy mailjet
```

### 3. Run Migration

Apply the database migration to enable automatic user syncing:

```bash
supabase db push
```

Or manually run:
```sql
-- Run the migration file: 20251201_mailjet_user_sync.sql
```

**Note:** The database trigger uses `pg_net` for async HTTP calls. If `pg_net` is not available, user syncing will need to be handled at the application layer.

## Admin Interface

Super administrators can access the email management interface at `/admin/emails`.

### Features

1. **Contact Lists**: View and manage Mailjet contact lists
2. **Sync Users**: Manually sync all Supabase users to Mailjet
3. **Add Contacts**: Manually add individual contacts
4. **Send Campaigns**: Send HTML emails to entire contact lists

## API Reference

### Base URL
```
POST {SUPABASE_URL}/functions/v1/mailjet
```

### Authentication
All requests require a Bearer token (either user access token or service role key).

### Operations

#### Add Contact
```json
{
  "operation": "add_contact",
  "email": "user@example.com",
  "name": "John Doe",
  "listId": 12345  // optional, uses default list if not provided
}
```

#### List Contacts
```json
{
  "operation": "list_contacts",
  "listId": 12345,  // optional
  "limit": 100,
  "offset": 0
}
```

#### Get Contact Lists
```json
{
  "operation": "get_lists"
}
```

#### Create Contact List
```json
{
  "operation": "create_list",
  "name": "My Newsletter"
}
```

#### Send Email
```json
{
  "operation": "send_email",
  "to": [{ "email": "user@example.com", "name": "John" }],
  "subject": "Hello!",
  "htmlContent": "<h1>Welcome</h1><p>Hello there!</p>",
  "textContent": "Welcome! Hello there!"
}
```

#### Send Campaign to List
```json
{
  "operation": "send_campaign",
  "listId": 12345,
  "subject": "Newsletter #1",
  "htmlContent": "<h1>Our Newsletter</h1><p>Content here...</p>",
  "senderEmail": "newsletter@example.com",
  "senderName": "Our Team"
}
```

#### Sync All Users
```json
{
  "operation": "sync_users",
  "listId": 12345  // optional
}
```

#### Get Statistics
```json
{
  "operation": "get_stats",
  "listId": 12345  // optional
}
```

## Automatic User Sync

When a user signs in and accesses any protected page:
1. The `SidebarLayout` component loads the user
2. `syncCurrentUserToMailjet()` is called (non-blocking, runs in background)
3. The function checks if the user was already synced this session (via sessionStorage)
4. If not synced, it calls the `mailjet` edge function with `operation: add_contact`
5. The user is added to the default contact list (idempotent - won't create duplicates)

**Note:** The database trigger approach (`trigger_sync_user_to_mailjet`) requires `pg_net` extension and Vault configuration which may not be available on all Supabase plans. The application-layer sync is the primary mechanism.

### Manual Sync

To sync all existing users to Mailjet:
1. Go to Admin > Email Lists
2. Click "Sync All Users"
3. Wait for the operation to complete

Or via API:
```bash
curl -X POST '{SUPABASE_URL}/functions/v1/mailjet' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{"operation": "sync_users"}'
```

## Error Handling

The Mailjet integration handles common errors:
- Duplicate contacts: Existing contacts are updated, not duplicated
- Invalid emails: Logged and skipped during bulk sync
- Rate limits: Consider batching for large syncs

## Security

- Only super admins can access most operations
- `add_contact` can be called internally for new signups
- All other operations require super_admin role verification
- Service role key should only be used for server-to-server calls

## Frontend Usage

```typescript
import { mailjetApi } from '@/lib/mailjet';

// Add a contact
await mailjetApi.addContact('user@example.com', 'John Doe');

// Get contact lists
const { lists } = await mailjetApi.getContactLists();

// Send a campaign
await mailjetApi.sendCampaign({
  listId: 12345,
  subject: 'Welcome!',
  htmlContent: '<h1>Hello!</h1>'
});
```

## Troubleshooting

### Users not syncing automatically
- Check if `pg_net` extension is enabled in Supabase
- Verify environment variables are set for edge functions
- Check edge function logs for errors

### Emails not sending
- Verify Mailjet sender domain is verified
- Check Mailjet dashboard for delivery issues
- Ensure recipients are not in suppression list

### API returning 401
- Check if access token is valid
- Verify user has super_admin role for protected operations

## File Structure

```
supabase/
  functions/
    mailjet/
      index.ts          # Main edge function
  migrations/
    20251201_mailjet_user_sync.sql  # Database trigger

src/
  lib/
    mailjet.ts          # Frontend API client
  pages/
    AdminEmails.tsx     # Admin UI component
```
