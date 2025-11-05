import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User } from 'lucide-react';
import { Calendar, Clock, MapPin, Phone, ShoppingCart, Star, Package } from "lucide-react";

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  richContent?: any;
}

interface ChatMessageProps {
  message: Message;
  storeLogo: string;
  onActionClick?: (action: string, data?: any) => void;
}

// Product Card Component
const ProductCard = ({ product, onActionClick }: { product: any; onActionClick?: (action: string, data?: any) => void }) => (
  <Card className="w-full border border-border shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-2 p-4">
      <div className="aspect-square bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-2 flex items-center justify-center h-20">
        <Package className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <CardTitle className="text-sm font-semibold text-foreground truncate leading-tight">
        {product.name}
      </CardTitle>
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-primary">
          ${product.price}
        </span>
        <Badge variant={parseInt(product.stock) > 0 ? "default" : "destructive"} className="text-xs">
          {parseInt(product.stock) > 0 ? `${product.stock}` : 'Out'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="pt-0 p-4">
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-tight">
        {product.description}
      </p>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="flex-1 text-xs h-8"
          onClick={() => onActionClick?.('add_to_cart', product)}
          disabled={parseInt(product.stock) === 0}
        >
          <ShoppingCart className="h-3 w-3 mr-1" />
          Add
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="text-xs h-8 px-3"
          onClick={() => onActionClick?.('view_details', product)}
        >
          Details
        </Button>
      </div>
    </CardContent>
  </Card>
);

// Service Card Component
const ServiceCard = ({ service, onActionClick }: { service: any; onActionClick?: (action: string, data?: any) => void }) => (
  <Card className="w-full border border-border shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <CardTitle className="text-lg font-semibold text-foreground flex-1">
          {service.serviceName}
        </CardTitle>
        <Badge variant="secondary" className="ml-2">
          {service.duration} min
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-sm">{service.category}</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xl font-bold text-primary">${service.price}</span>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <p className="text-sm text-muted-foreground mb-4">
        {service.description}
      </p>
      <Button 
        size="sm" 
        className="w-full"
        onClick={() => onActionClick?.('book_service', service)}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Book Now
      </Button>
    </CardContent>
  </Card>
);

// Hours List Component
const HoursList = ({ hours }: { hours: any[] }) => (
  <Card className="w-full border border-border shadow-sm">
    <CardHeader>
      <CardTitle className="text-lg font-semibold flex items-center">
        <Clock className="h-5 w-5 mr-2" />
        Operating Hours
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="space-y-2">
        {hours.map((day, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
            <span className="font-medium text-foreground">{day.day}</span>
            <div className="flex items-center gap-2">
              {day.isOpen === 'Yes' ? (
                <span className="text-sm text-muted-foreground">
                  {day.openTime} - {day.closeTime}
                </span>
              ) : (
                <Badge variant="destructive">Closed</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Booking Card Component
const BookingCard = ({ booking, onActionClick }: { booking: any; onActionClick?: (action: string, data?: any) => void }) => (
  <Card className="w-full border border-border shadow-sm">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">
          {booking.service}
        </CardTitle>
        <Badge variant={
          booking.status === 'Confirmed' ? 'default' :
          booking.status === 'Pending' ? 'secondary' : 'destructive'
        }>
          {booking.status}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="pt-0 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="text-sm">{booking.date} at {booking.time}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Phone className="h-4 w-4" />
        <span className="text-sm">{booking.phone}</span>
      </div>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => onActionClick?.('reschedule', booking)}
        >
          Reschedule
        </Button>
        <Button 
          size="sm" 
          variant="destructive"
          onClick={() => onActionClick?.('cancel', booking)}
        >
          Cancel
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, storeLogo, onActionClick }) => {
  const renderRichContent = () => {
    if (!message.richContent) return null;

    const { type, data } = message.richContent;

    switch (type) {
      case 'products':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No products available at the moment.</p>
            </div>
          );
        }

        const [currentIndex, setCurrentIndex] = useState(0);
        const visibleCards = 6; // Number of cards visible at a time

        const handleNext = () => {
          const maxIndex = Math.max(0, data.length - visibleCards);
          if (currentIndex < maxIndex) {
            setCurrentIndex(currentIndex + 1);
          }
        };

        const handlePrev = () => {
          if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          }
        };

        return (
          <div className="relative mt-3">
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10"
              disabled={currentIndex === 0}
            >
              ←
            </button>
            <div className="flex overflow-hidden mx-8">
              <div
                className="flex transition-transform duration-300 gap-2"
                style={{ transform: `translateX(-${currentIndex * (100 / visibleCards)}%)` }}
              >
                {data.map((product: any, index: number) => (
                  <div key={index} className="flex-shrink-0" style={{ width: 'calc(100% / 6 - 8px)' }}>
                    <ProductCard product={product} onActionClick={onActionClick} />
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10"
              disabled={currentIndex >= Math.max(0, data.length - visibleCards)}
            >
              →
            </button>
          </div>
        );

      case 'services':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No services available at the moment.</p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {data.slice(0, 4).map((service: any, index: number) => (
              <ServiceCard 
                key={index} 
                service={service} 
                onActionClick={onActionClick}
              />
            ))}
          </div>
        );

      case 'hours':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Operating hours not available.</p>
            </div>
          );
        }
        return (
          <div className="mt-3">
            <HoursList hours={data} />
          </div>
        );

      case 'bookings':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No bookings found.</p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {data.slice(0, 4).map((booking: any, index: number) => (
              <BookingCard 
                key={index} 
                booking={booking} 
                onActionClick={onActionClick}
              />
            ))}
          </div>
        );

      case 'quick_actions':
        return (
          <div className="flex flex-wrap gap-2 mt-3">
            {data.map((action: string, index: number) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onActionClick?.(action)}
                className="text-xs h-8"
              >
                {action}
              </Button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.type === 'bot' && (
        <div className="mt-1 flex-shrink-0">
          <Avatar className="w-9 h-9" variant="bot">
            <AvatarFallback className="avatar-fallback">
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className={`max-w-[85%] ${message.type === 'user' ? 'max-w-[70%]' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          message.type === 'user'
            ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground shadow-sm border border-border'
        }`}>
          <div className="text-sm leading-relaxed">{message.content}</div>
          <div className="text-xs opacity-70 mt-2">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {renderRichContent()}
      </div>

      {message.type === 'user' && (
        <div className="mt-1 flex-shrink-0">
          <Avatar className="w-9 h-9" variant="user">
            <AvatarFallback className="avatar-fallback">
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
