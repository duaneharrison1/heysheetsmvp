-- Migration to sync new users with Mailjet
-- This creates a webhook trigger that calls the mailjet edge function
-- when a new user signs up

-- Create a function to sync new users to Mailjet
CREATE OR REPLACE FUNCTION public.sync_user_to_mailjet()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  response_status int;
BEGIN
  -- Get environment variables (these need to be set in vault)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Skip if no URL configured (local development)
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE LOG 'Mailjet sync skipped: missing configuration';
    RETURN NEW;
  END IF;
  
  -- Call the mailjet edge function asynchronously using pg_net if available
  -- Otherwise, this will be handled by the application layer
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/mailjet',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'operation', 'add_contact',
        'email', NEW.email,
        'name', COALESCE(NEW.full_name, split_part(NEW.email, '@', 1))
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE LOG 'Mailjet sync failed for user %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_profiles table
DROP TRIGGER IF EXISTS trigger_sync_user_to_mailjet ON public.user_profiles;

CREATE TRIGGER trigger_sync_user_to_mailjet
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_to_mailjet();

-- Also create a trigger for direct auth.users inserts if accessible
-- Note: This may not work on all Supabase plans due to auth schema restrictions
-- The user_profiles trigger is the primary mechanism

-- Add comment explaining the integration
COMMENT ON FUNCTION public.sync_user_to_mailjet() IS 
  'Syncs new user signups to Mailjet contact list for email marketing. 
   Called automatically when a new user_profiles row is inserted.
   Requires MAILJET_API_KEY and MAILJET_SECRET_KEY environment variables in edge functions.';
