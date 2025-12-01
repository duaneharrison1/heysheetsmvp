import { supabase } from '@/lib/supabase';

// Centralized sign-out helper used across the app.
// Calls Supabase signOut, clears a legacy token key if present,
// and performs a hard redirect to the provided path (default `/auth`).
export async function signOutAndRedirect(redirectTo = '/auth') {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('signOut error', err);
  }

  try {
    localStorage.removeItem('supabase.auth.token');
  } catch (e) {
    // ignore
  }

  // Hard navigation to ensure in-memory React state is cleared
  window.location.href = redirectTo;
}
