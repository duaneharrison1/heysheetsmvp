# Role-Based Access Control (RBAC) Setup Guide

⚠️ **IMPORTANT: Use RBAC_CLEAN.sql, NOT RBAC_SETUP.sql**

The original RBAC_SETUP.sql broke the stores table. Use **RBAC_CLEAN.sql** instead - it's safe and doesn't touch stores RLS.

## Overview
This guide sets up a role-based access control system with a Super Admin that can view all stores and user accounts.

## Creating the Super Admin Account

**Step-by-step:**

1. **Create the auth user** via Supabase Dashboard:
   - Go to **Authentication > Users**
   - Click **"Create new user"**
   - Email: `admin@heysheets.com`
   - Password: `HeySheets2025Admin!`
   - Click **Create user**

2. **Copy the generated User ID** (a UUID like `a1b2c3d4-...`)

3. **Assign super admin role**:
   - In RBAC_CLEAN.sql, the query `UPDATE public.user_profiles SET role = 'super_admin' WHERE email = 'admin@heysheets.com'` will automatically find your admin user
   - Just run RBAC_CLEAN.sql and it handles it

⚠️ **IMPORTANT: Change the password immediately in production!**

## Prerequisites

- `DATABASE_SETUP.sql` must be run first (this creates the stores table)
- The user_profiles table must not already exist

## Setup Instructions

### 1. Run DATABASE_SETUP.sql First

If you haven't already, run `DATABASE_SETUP.sql` to create the stores table with initial RLS policies.

### 2. Run the RBAC Setup Script

Run the `RBAC_CLEAN.sql` file in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `RBAC_CLEAN.sql`
4. Click "Run"

This script will:
- Create a `user_role` enum type (`user` or `super_admin`)
- Create a `user_profiles` table to store user roles
- Set up RLS policies for role-based access
- Create automatic user profile creation on signup
- Create the default super admin account

### 3. Test the Setup

#### Sign in as Super Admin
1. Go to your app's auth page
2. Use the default credentials above
3. You should see an "Admin Dashboard" link in the sidebar (blue shield icon)

#### Access the Admin Dashboard
1. Click the "Admin Dashboard" link in the sidebar
2. You should see:
   - Total number of stores
   - Total number of users
   - List of all stores with their owners
   - Table of all users with their roles and join dates

### 4. Create Additional Super Admins

To promote a user to super admin:

```sql
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE email = 'user@example.com';
```

### 5. Create Regular Users

Regular users are automatically created with the `user` role when they sign up. They can only see their own stores.

## How It Works

### Role Hierarchy
- **User**: Regular user, can only see their own stores
- **Super Admin**: Can see all stores and all user accounts

### RLS Policies

#### user_profiles table
- **Users can view their own profile**: Regular users can only see their own profile
- **Super admins can view all profiles**: Super admins can see all user profiles

#### stores table (SELECT policy - REPLACES DATABASE_SETUP.sql policy)
- **Users can view their own stores or super admin views all**: 
  - Regular users see only their own stores
  - Super admins see all stores on the platform
  
#### stores table (CREATE, UPDATE, DELETE policies - FROM DATABASE_SETUP.sql)
- Policies remain unchanged from DATABASE_SETUP.sql
- Regular users can only create/update/delete their own stores
- If super admins need to modify other users' stores, use the service_role via edge functions

### Automatic User Profile Creation
When a new user signs up via email/OAuth:
1. Auth.users record is created by Supabase
2. A trigger automatically creates a corresponding user_profiles record
3. The user is assigned the `user` role by default

## File Structure

```
src/
├── hooks/
│   └── useUserRole.ts          # Hook to get current user's role
├── pages/
│   └── AdminDashboard.tsx      # Super admin dashboard page
└── components/
    └── SidebarLayout.tsx        # Updated with admin link (if super admin)
```

## Security Notes

1. **Password Security**: The default password is for initial setup only. Change it immediately.
2. **RLS Enforcement**: All queries respect the RLS policies. Super admins are verified server-side.
3. **Email/OAuth**: The system works with both email and OAuth sign-up methods.

## Troubleshooting

### Admin link not showing up?
- Make sure you're signed in with the admin account
- Check browser console for errors in loading the user role
- Verify the user_profiles table has an entry with `role = 'super_admin'`

### Can't access admin dashboard?
- Verify you're signed in as a super admin
- Check that your user_id matches a super admin in user_profiles table
- Look for errors in the browser console

### User profile not created automatically?
- The trigger requires the `pgcrypto` extension
- Verify the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

## Next Steps

1. Change the default admin password
2. Create additional admin accounts as needed
3. Test role-based access with different user accounts
4. Customize the Admin Dashboard UI as needed
