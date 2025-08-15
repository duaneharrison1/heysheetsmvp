import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Star, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface Store {
  id: string;
  name: string;
  type: 'salon' | 'coach' | 'craft' | 'education';
  description: string;
  location: string;
  rating: number;
  isOpen: boolean;
  image?: string;
}

interface StoreCardProps {
  store: Store;
}

const typeIcons = {
  salon: '💇‍♀️',
  coach: '🏋️‍♂️', 
  craft: '🎨',
  education: '📚'
};

const typeColors = {
  salon: 'hsl(320 65% 60%)',
  coach: 'hsl(200 70% 55%)',
  craft: 'hsl(25 80% 60%)',
  education: 'hsl(150 60% 50%)'
};

export function StoreCard({ store }: StoreCardProps) {
  const navigate = useNavigate();

  const handleManageClick = () => {
    navigate(`/manage/${store.id}`);
  };

  const handleViewClick = () => {
    navigate(`/store/${store.id}`);
  };

  return (
    <Card className="business-card group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${typeColors[store.type]}20` }}
        >
          {typeIcons[store.type]}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={store.isOpen ? "default" : "secondary"} className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {store.isOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
        {store.name}
      </h3>
      
      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
        {store.description}
      </p>

      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {store.location}
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          {store.rating}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border">
        <Button 
          onClick={handleViewClick}
          variant="outline" 
          size="sm" 
          className="flex-1"
        >
          View Store
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <Button 
          onClick={handleManageClick}
          size="sm" 
          className="flex-1"
          style={{ backgroundColor: typeColors[store.type] }}
        >
          Manage Data
        </Button>
      </div>
    </Card>
  );
}