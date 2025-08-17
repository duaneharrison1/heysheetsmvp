import { StoreCard, Store } from "@/components/StoreCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useState } from "react";

// Sample data for different business types
const sampleStores: Store[] = [
  {
    id: 'salon-1',
    name: 'Bella Beauty Salon',
    type: 'salon',
    description: 'Premium hair styling, coloring, and spa services. Expert stylists with 10+ years experience.',
    location: 'Downtown Plaza',
    rating: 4.8,
    isOpen: true,
  },
  {
    id: 'coach-1',
    name: 'FitLife Personal Training',
    type: 'coach',
    description: 'Certified personal trainers offering customized fitness programs and nutrition guidance.',
    location: 'Sports Complex',
    rating: 4.9,
    isOpen: true,
  },
  {
    id: 'craft-1',
    name: 'Artisan Craft Studio',
    type: 'craft',
    description: 'Pottery, woodworking, and painting classes. Custom handmade gifts and art supplies.',
    location: 'Arts District',
    rating: 4.7,
    isOpen: false,
  },
  {
    id: 'education-1',
    name: 'Little Scholars Academy',
    type: 'education',
    description: 'Early childhood education with STEM focus. After-school programs and summer camps.',
    location: 'Family Center',
    rating: 4.9,
    isOpen: true,
  },
  {
    id: 'salon-2',
    name: 'Glow Skincare Clinic',
    type: 'salon',
    description: 'Medical-grade facials, anti-aging treatments, and dermatology consultations.',
    location: 'Medical Plaza',
    rating: 4.6,
    isOpen: true,
  },
  {
    id: 'coach-2',
    name: 'Mindful Life Coaching',
    type: 'coach',
    description: 'Life coaching, career guidance, and wellness programs for personal development.',
    location: 'Wellness Center',
    rating: 4.8,
    isOpen: true,
  },
];

export default function StoresList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stores] = useState<Store[]>(sampleStores);

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Business Hub
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your stores and services in one place
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Business
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="relative max-w-md">
            {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search stores and services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            /> */}
          </div>
        </div>

        {/* Store Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>

        {/* Empty State */}
        {filteredStores.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No stores found matching "{searchTerm}"
            </p>
          </div>
        )}

        {/* Stats Footer */}
        {/* <div className="mt-12 p-6 rounded-xl bg-card/50 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stores.length}</div>
              <div className="text-sm text-muted-foreground">Total Businesses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {stores.filter(s => s.isOpen).length}
              </div>
              <div className="text-sm text-muted-foreground">Currently Open</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {(stores.reduce((acc, s) => acc + s.rating, 0) / stores.length).toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {new Set(stores.map(s => s.type)).size}
              </div>
              <div className="text-sm text-muted-foreground">Business Types</div>
            </div>
          </div>
        </div> */}
      </main>
    </div>
  );
}