import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import StoreSetup from '@/components/store/StoreSetup';
import { H1, Lead } from '@/components/ui/heading';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const StoreSettings = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!storeId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .eq('id', storeId)
          .single();
        if (error) {
          console.error('Error loading store:', error);
          setStore(null);
        } else {
          setStore(data);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storeId]);

  if (!storeId) return <div>Invalid store ID</div>;

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!store) return <div className="py-8 text-center text-muted-foreground">Store not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <H1>{store.name}</H1>
        <Lead>Settings &amp; integration for <span className="font-medium">{store.name}</span></Lead>
      </div>

      <div className="max-w-3xl mx-auto">
        <StoreSetup storeId={storeId} />
      </div>
    </div>
  );
};

export default StoreSettings;
