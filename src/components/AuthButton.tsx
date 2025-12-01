import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

const AuthButton = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted.current) setUser(user);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted.current) {
        setUser(session?.user ?? null);
      }
    });
    
    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) toast.error(error.message ?? 'Sign in failed');
    } catch (error) {
      toast.error('Sign in failed');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    
    // Create a timeout to force redirect if signOut takes too long
    const timeoutId = setTimeout(() => {
      console.warn('Sign out timeout - forcing redirect');
      window.location.href = '/auth';
    }, 3000);
    
    try {
      // Clear any cached data first
      localStorage.removeItem('supabase.auth.token');
      
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      clearTimeout(timeoutId);
      // Always redirect with hard page reload to clear all state
      window.location.href = '/auth';
    }
  };

  if (user) {
    return (
      <Button onClick={handleSignOut} disabled={loading} variant="outline" className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Sign Out
      </Button>
    );
  }

  return (
    <Button onClick={handleSignIn} disabled={loading} className="w-full">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
      Sign in with Google
    </Button>
  );
};

export default AuthButton;