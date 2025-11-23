import * as React from 'react'
import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, RotateCcw } from 'lucide-react'

export const LeadForm: React.FC<{
  onSubmit?: (data: any) => void
  maxWidth?: string
  /** Force buttons to stack vertically regardless of viewport */
  stackButtons?: boolean
}> = ({ onSubmit, maxWidth, stackButtons }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = { name, email, phone, message }
    try {
      onSubmit?.(payload)
    } finally {
      // small delay to show submitting state in showcase
      setTimeout(() => setSubmitting(false), 400)
    }
  }

  return (
    <Card
      className={`w-full ${maxWidth ? '' : 'mx-auto max-w-full sm:max-w-md'} border border-border shadow-sm`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Contact Us</h3>
      </CardHeader>

      <CardContent className="pt-0 p-3 sm:p-6 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>

          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 555 555 5555" />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Short note or requirements" />
          </div>

          <div className={stackButtons ? 'flex flex-col gap-2' : 'flex flex-col md:flex-row gap-2'}>
            <Button type="submit" className={stackButtons ? 'w-full' : 'w-full md:flex-1'} disabled={submitting}>
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Sending...' : 'Send Message'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={stackButtons ? 'w-full' : 'w-full md:w-auto'}
              onClick={() => {
                setName('')
                setEmail('')
                setPhone('')
                setMessage('')
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default LeadForm
