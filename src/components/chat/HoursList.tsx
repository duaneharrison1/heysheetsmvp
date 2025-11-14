import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

export const HoursList: React.FC<{ hours: any[] }> = ({ hours }) => {
  return (
    <Card className="w-full max-w-full sm:max-w-md border border-border shadow-sm">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg font-semibold flex items-center">
          <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Operating Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-6">
        <div className="space-y-2">
          {hours.map((day, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-b-0 gap-2">
              <span className="font-medium text-foreground text-sm sm:text-base flex-shrink-0">{day.day}</span>
              <div className="flex items-center gap-2 text-right">
                {day.isOpen === 'Yes' ? (
                  <span className="text-xs sm:text-sm text-muted-foreground">{day.openTime} - {day.closeTime}</span>
                ) : (
                    <Badge variant="destructive">Closed</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default HoursList
