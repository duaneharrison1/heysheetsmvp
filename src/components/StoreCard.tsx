import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Clock, MapPin, ArrowRight, Plus, Settings as SettingsIcon } from "lucide-react";
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
  store?: Store;
  /** when true, renders a subtle create-new-store card */
  create?: boolean;
  onCreate?: () => void;
}
const typeIcons = {
  salon: '💇‍♀️',
  coach: '🏋️‍♂️', 
  craft: '🎨',
  education: '📚'
};

export function StoreCard({ store, create, onCreate }: StoreCardProps) {
  const navigate = useNavigate();

  const handleManageClick = () => {
    navigate(`/settings/${store.id}`);
  };

  const handleViewClick = () => {
    navigate(`/store/${store.id}`);
  };

  const handleViewInNewTab = () => {
    const url = `/store/${store.id}`;
    const newWindow = window.open(url, '_blank');
    if (newWindow) newWindow.opener = null;
  };

  if (create) {
    return (
      <Card className="cursor-pointer border-dashed hover:border-primary transition-colors h-full" onClick={onCreate}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
          <div className="rounded-full border border-border p-3 mb-3">
            <Plus className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg mb-1">Create New Store</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">Add a new store and connect to a Google Sheet</CardDescription>
        </CardContent>
      </Card>
    )
  }

  if (!store) return null;

  return (
  <Card className="group cursor-pointer relative h-full flex flex-col" onClick={handleViewClick}>
      {/* Status badge top-right */}
      <div className="absolute right-4 top-4">
        <Badge variant={store.isOpen ? "default" : "secondary"} className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          {store.isOpen ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <CardHeader className="flex items-start justify-between mb-2 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10" >
            <AvatarFallback className="avatar-fallback">
              <span className="text-xl">{typeIcons[store.type]}</span>
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg font-semibold mb-0 group-hover:text-primary transition-colors">{store.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{store.type}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-1">
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {store.description}
        </p>

        <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
          {store.location ? (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {store.location}
            </div>
          ) : null}
        </div>
      </CardContent>

  <CardFooter className="px-4 pb-4 pt-0 flex gap-2">
        <Button 
          onClick={(e)=>{e.stopPropagation(); handleViewInNewTab()}}
          variant="outline" 
          size="sm" 
          className="flex-1"
        >
          View Store
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <Button 
          onClick={(e)=>{e.stopPropagation(); handleManageClick()}}
          size="sm" 
          variant="brand"
          className="flex-1"
        >
          <SettingsIcon className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </CardFooter>
    </Card>
  )
}