import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AuthButton from '@/components/AuthButton';

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">HeySheets</h2>
          <p className="mt-2 text-sm text-gray-600">
            Transform your Google Sheets into intelligent chatbots
          </p>
        </div>
        <AuthButton />
      </div>
    </div>
  );
};

export default Auth;
