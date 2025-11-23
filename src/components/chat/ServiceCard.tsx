import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calendar, Info } from 'lucide-react'

export const ServiceCard: React.FC<{
  service: any
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}> = ({ service, onActionClick, maxWidth }) => {
  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full'} border border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-2 flex items-center justify-center h-16 sm:h-20 overflow-hidden">
          {service?.image ? (
            <img
              src={service.image}
              alt={service.serviceName || 'service image'}
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex-1 leading-tight truncate">{service.serviceName}</CardTitle>
          <Badge variant="secondary" className="flex-shrink-0">{service.duration} min</Badge>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-muted-foreground">
          <span className="text-xs sm:text-sm">{service.category}</span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span className="text-lg sm:text-xl font-bold text-primary">${service.price}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-6 flex-1 flex flex-col">
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed line-clamp-3">{service.description}</p>
        <div className="flex flex-col gap-2 mt-auto">
          <Button
            size="sm"
            className="w-full flex justify-center items-center"
            onClick={() => onActionClick?.('book_service', service)}
          >
            <span className="flex items-center justify-center gap-2 w-full">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate text-center">Book Now</span>
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full px-3 sm:px-4 flex justify-center items-center"
            onClick={() => onActionClick?.('view_details', service)}
          >
            <span className="flex items-center justify-center gap-2 w-full">
              <Info className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate text-center">Details</span>
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ServiceCard
