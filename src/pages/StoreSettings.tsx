import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import StoreSetup from '@/components/store/StoreSetup';

const StoreSettings = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  if (!storeId) return <div>Invalid store ID</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <h1 className="text-2xl font-bold mt-2">Store Settings</h1>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <StoreSetup storeId={storeId} />
      </div>
    </div>
  );
};

export default StoreSettings;
