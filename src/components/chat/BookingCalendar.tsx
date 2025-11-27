import * as React from "react"
import { useState } from "react"
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

export function BookingCalendar({
  service,
  slots,
  unavailableDates = [],
  prefill,
  onActionClick
}: BookingCalendarProps) {
  // State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    prefill?.date ? new Date(prefill.date + 'T00:00:00') : undefined
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

  // Computed
  const selectedDateStr = selectedDate?.toISOString().split('T')[0]
  const timeSlotsForDate = slots
    .filter(slot => slot.date === selectedDateStr)
    .map(slot => ({ time: slot.time, endTime: slot.endTime, spotsLeft: slot.spotsLeft }))

  // Dates that have availability (for highlighting)
  const availableDates = [...new Set(slots.map(s => s.date))]

  // Format time for display (14:00 -> 2:00 PM)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Handlers
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime(null) // Reset time when date changes
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
  }

  const handleContinue = () => {
    setStep('details')
  }

  const handleBack = () => {
    setStep('datetime')
  }

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return

    setIsSubmitting(true)

    onActionClick?.('confirm_booking', {
      service_name: service.name,
      service_id: service.id,
      date: selectedDateStr,
      time: selectedTime,
      customer_name: customerDetails.name,
      customer_email: customerDetails.email,
      customer_phone: customerDetails.phone
    })
  }

  const isDetailsComplete = customerDetails.name.trim() && customerDetails.email.trim()

  // Check if date has slots
  const isDateAvailable = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return availableDates.includes(dateStr)
  }

  // Check if date is in the past
  const isDateInPast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  return (
    <Card className="w-full max-w-lg border-border/50">
      {/* Step 1: Date & Time Selection */}
      {step === 'datetime' ? (
        <>
          <CardContent className="relative p-0">
            {/* Calendar Header */}
            <div className="p-4 border-b border-border/30">
              <div className="text-sm font-medium">{service.name}</div>
              {(service.duration || service.price) && (
                <div className="text-xs text-muted-foreground mt-1">
                  {service.duration && <span>{service.duration}</span>}
                  {service.duration && service.price && <span> • </span>}
                  {service.price && <span>HK${service.price}</span>}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row">
              {/* Calendar */}
              <div className="p-4 flex-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  defaultMonth={selectedDate || new Date()}
                  disabled={(date) => {
                    return isDateInPast(date) || !isDateAvailable(date)
                  }}
                  modifiers={{
                    available: (date) => isDateAvailable(date) && !isDateInPast(date),
                  }}
                  modifiersClassNames={{
                    available: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 font-medium",
                  }}
                  className="bg-transparent p-0"
                />
              </div>

              {/* Time Slots - Side Panel */}
              <div className="border-t md:border-t-0 md:border-l border-border/30 p-4 md:w-44 max-h-72 md:max-h-none overflow-y-auto">
                {selectedDate ? (
                  timeSlotsForDate.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground mb-2">
                        {selectedDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="grid gap-2">
                        {timeSlotsForDate.map(({ time, spotsLeft }) => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            onClick={() => handleTimeSelect(time)}
                            className="w-full justify-between text-sm h-9"
                            disabled={spotsLeft <= 0}
                          >
                            <span>{formatTime(time)}</span>
                            {spotsLeft <= 3 && spotsLeft > 0 && (
                              <span className="text-xs opacity-70 ml-2">
                                {spotsLeft} left
                              </span>
                            )}
                            {spotsLeft <= 0 && (
                              <span className="text-xs opacity-70 ml-2">
                                Full
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No times available for this date
                    </div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Select a date to see available times
                  </div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/30 px-4 py-4">
            <div className="text-sm w-full">
              {selectedDate && selectedTime ? (
                <>
                  <span className="font-medium">{service.name}</span> on{" "}
                  <span className="font-medium">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>{" "}
                  at <span className="font-medium">{formatTime(selectedTime)}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Select a date and time to continue</span>
              )}
            </div>
            <Button
              onClick={handleContinue}
              disabled={!selectedDate || !selectedTime}
              className="w-full"
            >
              Continue
            </Button>
          </CardFooter>
        </>
      ) : (
        /* Step 2: Customer Details */
        <>
          {/* Collapsed Date/Time Summary */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleBack}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                {selectedDate?.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })} at {selectedTime && formatTime(selectedTime)}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              Change
            </Button>
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
                  onChange={(e) => setCustomerDetails(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
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
                  onChange={(e) => setCustomerDetails(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
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
                  onChange={(e) => setCustomerDetails(prev => ({
                    ...prev,
                    phone: e.target.value
                  }))}
                  placeholder="+852 XXXX XXXX"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/30 px-4 py-4">
            <Button
              onClick={handleConfirm}
              disabled={!isDetailsComplete || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  )
}

export default BookingCalendar
