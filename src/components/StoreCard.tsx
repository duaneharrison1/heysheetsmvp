import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
      <CardHeader className="flex items-start justify-between mb-2 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10" variant={store.type}>
            <AvatarFallback className="avatar-fallback">
              <span className="text-xl">{typeIcons[store.type]}</span>
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg font-semibold mb-0 group-hover:text-primary transition-colors">{store.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{store.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={store.isOpen ? "default" : "secondary"} className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {store.isOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {store.description}
        </p>

        <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {store.location}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {store.rating}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
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
          variant="brand"
          className="flex-1"
        >
          Manage Data
        </Button>
      </CardFooter>
    </Card>
  );
}