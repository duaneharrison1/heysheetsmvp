import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AuthButton from '@/components/AuthButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4">
        <Card className="shadow-lg">
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 w-14 h-14 rounded-full flex items-center justify-center bg-black">
              <img src="/shop.svg" alt="HeySheets" className="w-8 h-8" />
            </div>
            <CardTitle>HeySheets</CardTitle>
            <CardDescription>Transform your Google Sheets into intelligent chatbots</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col items-center gap-4">
            <AuthButton />
            <p className="text-xs text-muted-foreground text-center">
              Sign in with your Google account to continue.
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <p className="text-xs text-muted-foreground mx-auto">No credit card required • Free to try</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
