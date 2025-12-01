import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { signOutAndRedirect } from '@/lib/auth';
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
    await signOutAndRedirect('/auth');
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