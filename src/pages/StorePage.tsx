import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Stores
            </Button>
            <h1 className="text-2xl font-bold">Store Landing Page</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Store Landing Page</h2>
          <p className="text-muted-foreground text-lg mb-8">
            This is a placeholder for the store landing page for store ID: {storeId}
          </p>
          <p className="text-muted-foreground">
            This page will show the public-facing landing page for each store/service 
            with the same layout template but customized content for each business.
          </p>
          
          <div className="mt-8 p-6 bg-card rounded-lg border">
            <h3 className="font-semibold mb-2">Coming Soon:</h3>
            <ul className="text-left text-muted-foreground space-y-1">
              <li>• Store information and branding</li>
              <li>• Service/product listings</li>
              <li>• Contact information</li>
              <li>• Online booking integration</li>
              <li>• Customer reviews</li>
              <li>• Photo gallery</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}