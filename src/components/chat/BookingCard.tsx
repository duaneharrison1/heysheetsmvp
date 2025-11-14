import * as React from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Phone } from 'lucide-react'

export const BookingCard: React.FC<{
  booking: any
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}> = ({ booking, onActionClick, maxWidth }) => {
  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full sm:max-w-md'} border border-border shadow-sm`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-foreground leading-tight flex-1">{booking.service}</h3>
          <Badge 
            variant={booking.status === 'Confirmed' ? 'default' : booking.status === 'Pending' ? 'secondary' : 'destructive'}
            className="flex-shrink-0"
          >
            {booking.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm">{booking.date} at {booking.time}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm break-all">{booking.phone}</span>
        </div>
        <div className="flex flex-col xs:flex-row gap-2 pt-1">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1" 
            onClick={() => onActionClick?.('reschedule', booking)}
          >
            Reschedule
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1" 
            onClick={() => onActionClick?.('cancel', booking)}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default BookingCard
