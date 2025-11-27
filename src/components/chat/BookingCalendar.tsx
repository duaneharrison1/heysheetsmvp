import * as React from "react"
import { useState, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"

interface BookingSlot {
  date: string        // "2025-12-05"
  time: string        // "14:00"
  endTime: string     // "16:00"
  spotsLeft: number   // 5
}

interface BookingCalendarProps {
  service: {
    id: string
    name: string
    duration?: string
    price?: number
  }
  slots: BookingSlot[]
  unavailableDates?: string[]
  prefill?: {
    date?: string
    time?: string
    name?: string
    email?: string
    phone?: string
  }
  onActionClick?: (action: string, data?: any) => void
}

/**
 * Format date to YYYY-MM-DD without timezone conversion
 */
function formatDateToYMD(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function BookingCalendar({
  service,
  slots,
  unavailableDates = [],
  prefill,
  onActionClick
}: BookingCalendarProps) {
  // State
  const [date, setDate] = useState<Date | undefined>(
    prefill?.date ? new Date(prefill.date + 'T12:00:00') : undefined
  )
  const [selectedTime, setSelectedTime] = useState<string | null>(
    prefill?.time || null
  )
  const [step, setStep] = useState<'datetime' | 'details'>('datetime')
  const [customerDetails, setCustomerDetails] = useState({
    name: prefill?.name || '',
    email: prefill?.email || '',
    phone: prefill?.phone || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Computed - use local date formatting to avoid timezone issues
  const selectedDateStr = date ? formatDateToYMD(date) : null

  // Get time slots for selected date
  const timeSlotsForDate = useMemo(() => {
    if (!selectedDateStr) return []
    return slots
      .filter(slot => slot.date === selectedDateStr)
      .map(slot => ({
        time: slot.time,
        spotsLeft: slot.spotsLeft
      }))
  }, [slots, selectedDateStr])

  // Dates that have available slots
  const availableDates = useMemo(() => {
    const dates = new Set<string>()
    slots.forEach(slot => {
      if (slot.spotsLeft > 0) dates.add(slot.date)
    })
    return Array.from(dates)
  }, [slots])

  // Check if date has slots
  const isDateAvailable = (checkDate: Date) => {
    const dateStr = formatDateToYMD(checkDate)
    return availableDates.includes(dateStr)
  }

  // Check if date is in the past
  const isDateInPast = (checkDate: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const check = new Date(checkDate)
    check.setHours(0, 0, 0, 0)
    return check < today
  }

  // Handlers
  const handleConfirm = () => {
    if (!date || !selectedTime || !customerDetails.name || !customerDetails.email) return

    setIsSubmitting(true)

    onActionClick?.('confirm_booking', {
      service_name: service.name,
      service_id: service.id,
      date: selectedDateStr,
      time: selectedTime,
      customer_name: customerDetails.name,
      customer_email: customerDetails.email,
      customer_phone: customerDetails.phone || undefined
    })
  }

  // Step 1: Date & Time Selection (Calendar-20 layout)
  if (step === 'datetime') {
    return (
      <Card className="w-full max-w-xl overflow-hidden">
        <CardContent className="relative p-0 md:pr-48">
          {/* Calendar - Left Side */}
          <div className="p-4 md:p-6">
            <div className="text-sm font-medium mb-1">{service.name}</div>
            {(service.duration || service.price) && (
              <div className="text-xs text-muted-foreground mb-4">
                {service.duration}{service.duration && service.price && ' • '}
                {service.price && `HK$${service.price}`}
              </div>
            )}
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => {
                setDate(newDate)
                setSelectedTime(null) // Reset time when date changes
              }}
              defaultMonth={date || new Date()}
              disabled={(checkDate) => {
                return isDateInPast(checkDate) || !isDateAvailable(checkDate)
              }}
              showOutsideDays={false}
              className="bg-transparent p-0"
              modifiers={{
                available: (d) => isDateAvailable(d) && !isDateInPast(d),
              }}
              modifiersClassNames={{
                available: "bg-green-50 hover:bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30",
              }}
            />
          </div>

          {/* Time Slots - Right Side (absolute on desktop) */}
          <div className="no-scrollbar inset-y-0 right-0 flex max-h-64 w-full scroll-pb-4 flex-col gap-2 overflow-y-auto border-t p-4 md:absolute md:max-h-none md:w-48 md:border-t-0 md:border-l md:p-6">
            {selectedDateStr ? (
              timeSlotsForDate.length > 0 ? (
                <div className="grid gap-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    {date?.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  {timeSlotsForDate.map(({ time, spotsLeft }) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => setSelectedTime(time)}
                      className="w-full justify-between shadow-none"
                      disabled={spotsLeft <= 0}
                    >
                      <span>{time}</span>
                      {spotsLeft <= 3 && spotsLeft > 0 && (
                        <span className="text-xs opacity-70">{spotsLeft} left</span>
                      )}
                      {spotsLeft <= 0 && (
                        <span className="text-xs opacity-70">Full</span>
                      )}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No times available
                </div>
              )
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                Select a date
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t px-4 py-4 md:flex-row md:px-6 md:py-5">
          <div className="text-sm flex-1">
            {date && selectedTime ? (
              <>
                <span className="font-medium">{service.name}</span> on{" "}
                <span className="font-medium">
                  {date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>{" "}
                at <span className="font-medium">{selectedTime}</span>
              </>
            ) : (
              "Select a date and time for your booking"
            )}
          </div>
          <Button
            onClick={() => setStep('details')}
            disabled={!date || !selectedTime}
            className="w-full md:w-auto"
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Step 2: Customer Details
  return (
    <Card className="w-full max-w-md">
      {/* Collapsed Date/Time Summary */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setStep('datetime')}
      >
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm">
            {date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {selectedTime}
          </span>
        </div>
        <Button variant="ghost" size="sm">Change</Button>
      </div>

      {/* Customer Details Form */}
      <CardContent className="p-4 space-y-4">
        <div className="text-sm font-medium">Your Details</div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="booking-name" className="text-xs">Name *</Label>
            <Input
              id="booking-name"
              value={customerDetails.name}
              onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="booking-email" className="text-xs">Email *</Label>
            <Input
              id="booking-email"
              type="email"
              value={customerDetails.email}
              onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
              placeholder="your@email.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="booking-phone" className="text-xs">Phone (optional)</Label>
            <Input
              id="booking-phone"
              type="tel"
              value={customerDetails.phone}
              onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+852 XXXX XXXX"
              className="mt-1"
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t px-4 py-4">
        <Button
          onClick={handleConfirm}
          disabled={!customerDetails.name || !customerDetails.email || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Booking...' : 'Confirm Booking'}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default BookingCalendar
