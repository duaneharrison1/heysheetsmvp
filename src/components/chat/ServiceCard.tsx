import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calendar } from 'lucide-react'

export const ServiceCard: React.FC<{
  service: any
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}> = ({ service, onActionClick, maxWidth }) => {
  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full sm:max-w-md'} border border-border shadow-sm hover:shadow-md transition-shadow`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex-1 leading-tight">{service.serviceName}</CardTitle>
          <Badge variant="secondary" className="flex-shrink-0">{service.duration} min</Badge>
        </div>
        <div className="flex flex-col xs:flex-row xs:items-center gap-2 text-muted-foreground">
          <span className="text-xs sm:text-sm">{service.category}</span>
          <Separator orientation="vertical" className="h-4 hidden xs:block" />
          <span className="text-lg sm:text-xl font-bold text-primary">${service.price}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-6">
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed">{service.description}</p>
        <div className="flex flex-col xs:flex-row gap-2">
          <Button 
            size="sm" 
            className="flex-1" 
            onClick={() => onActionClick?.('book_service', service)}
          >
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            Book Now
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="px-3 sm:px-4" 
            onClick={() => onActionClick?.('view_details', service)}
          >
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ServiceCard
