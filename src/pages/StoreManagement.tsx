import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building, Clock, Package, ShoppingCart, Calendar, Settings } from "lucide-react";
import { Spreadsheet } from "@/components/Spreadsheet";

const tabs = [
  {
    id: 'hours',
    label: 'Operating Hours',
    icon: Clock,
    columns: [
      { key: 'day', label: 'Day of Week' },
      { key: 'openTime', label: 'Open Time' },
      { key: 'closeTime', label: 'Close Time' },
      { key: 'isOpen', label: 'Open?' },
      { key: 'notes', label: 'Notes' },
    ],
    initialData: [
      { day: 'Monday', openTime: '9:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: '' },
      { day: 'Tuesday', openTime: '9:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: '' },
      { day: 'Wednesday', openTime: '9:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: '' },
      { day: 'Thursday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Extended hours' },
      { day: 'Friday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Extended hours' },
      { day: 'Saturday', openTime: '10:00 AM', closeTime: '5:00 PM', isOpen: 'Yes', notes: '' },
      { day: 'Sunday', openTime: '', closeTime: '', isOpen: 'No', notes: 'Closed' },
    ]
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    columns: [
      { key: 'name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'price', label: 'Price', type: 'number' as const },
      { key: 'stock', label: 'Stock', type: 'number' as const },
      { key: 'description', label: 'Description' },
    ],
    initialData: [
      { name: 'Premium Shampoo', category: 'Hair Care', price: '25.99', stock: '50', description: 'Sulfate-free formula' },
      { name: 'Hair Treatment', category: 'Hair Care', price: '45.00', stock: '25', description: 'Deep conditioning treatment' },
    ]
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    columns: [
      { key: 'orderId', label: 'Order ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'date', label: 'Date' },
      { key: 'total', label: 'Total', type: 'number' as const },
      { key: 'status', label: 'Status' },
    ],
    initialData: []
  },
  {
    id: 'services',
    label: 'Services',
    icon: Settings,
    columns: [
      { key: 'serviceName', label: 'Service Name' },
      { key: 'duration', label: 'Duration (min)', type: 'number' as const },
      { key: 'price', label: 'Price', type: 'number' as const },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
    ],
    initialData: [
      { serviceName: 'Haircut & Style', duration: '60', price: '75.00', category: 'Hair', description: 'Cut and style' },
      { serviceName: 'Hair Color', duration: '120', price: '120.00', category: 'Hair', description: 'Full color service' },
    ]
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: Calendar,
    columns: [
      { key: 'bookingId', label: 'Booking ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'service', label: 'Service' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'phone', label: 'Phone', type: 'tel' as const },
      { key: 'status', label: 'Status' },
    ],
    initialData: []
  },
];

// Sample store data for header
const sampleStores = {
  'salon-1': { name: 'Bella Beauty Salon', type: 'salon' },
  'coach-1': { name: 'FitLife Personal Training', type: 'coach' },
  'craft-1': { name: 'Artisan Craft Studio', type: 'craft' },
  'education-1': { name: 'Little Scholars Academy', type: 'education' },
  'salon-2': { name: 'Glow Skincare Clinic', type: 'salon' },
  'coach-2': { name: 'Mindful Life Coaching', type: 'coach' },
};

export default function StoreManagement() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const store = storeId ? sampleStores[storeId as keyof typeof sampleStores] : null;

  if (!store || !storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
          <Button onClick={() => navigate('/')}>Return to Stores</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Stores
              </Button>
              <div className="flex items-center gap-3">
                <Building className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">{store.name}</h1>
                  <p className="text-muted-foreground capitalize">
                    {store.type} Management Dashboard
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="hours" className="w-full">
          {/* Tab List - Google Sheets style bottom tabs */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            <div className="h-[600px]">
              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0 h-full">
                  <Spreadsheet
                    storeId={storeId || ''}
                    tabName={tab.id}
                    columns={tab.columns}
                    initialData={tab.initialData}
                  />
                </TabsContent>
              ))}
            </div>
            
            {/* Bottom tab navigation - Google Sheets style */}
            <div className="border-t border-border bg-muted/30">
              <TabsList className="h-auto bg-transparent p-0 w-full justify-start">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="h-10 rounded-none border-r border-border last:border-r-0 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-primary gap-2 px-4"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}