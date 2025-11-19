import * as React from 'react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export const LeadFormWithSelection: React.FC<{
  products?: any[]
  services?: any[]
  initialItemType?: 'service' | 'product'
  onSubmit?: (payload: any) => void
  maxWidth?: string
}> = ({ products = [], services = [], initialItemType = 'product', onSubmit, maxWidth }) => {
  const [itemType, setItemType] = useState<'service' | 'product'>(initialItemType)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentItems = itemType === 'product' ? products : services
    if (!currentItems || currentItems.length === 0) setSelectedIndex(-1)
    else if (selectedIndex >= currentItems.length) setSelectedIndex(0)
  }, [products, services, itemType])

  const currentItems = itemType === 'product' ? products : services
  const selected = currentItems && currentItems.length > 0 && selectedIndex >= 0 ? currentItems[selectedIndex] : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      itemType,
      selected: selected ? { ...selected } : null,
      contact: { name, email, phone, message }
    }
    try {
      onSubmit?.(payload)
    } finally {
      setTimeout(() => setSubmitting(false), 400)
    }
  }

  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full sm:max-w-md'} border border-border shadow-sm`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Get in touch with us</h3>
      </CardHeader>

      <CardContent className="pt-0 p-3 sm:p-6 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Select {itemType === 'service' ? 'a service' : 'a product'}</Label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm pr-10 appearance-none focus:outline-none"
                value={selectedIndex}
                onChange={e => setSelectedIndex(Number(e.target.value))}
              >
                {(!currentItems || currentItems.length === 0) && <option value={-1}>No items available</option>}
                {currentItems && currentItems.map((it, idx) => (
                  <option key={idx} value={idx}>{'serviceName' in it ? it.serviceName : it.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {selected && (
            <div className="p-2 border rounded bg-muted/5">
              <div className="font-medium">{'serviceName' in selected ? selected.serviceName : selected.name}</div>
              {selected.category && <div className="text-xs text-muted-foreground">{selected.category}</div>}
              {selected.description && <div className="text-sm mt-1">{selected.description}</div>}
            </div>
          )}

          <div>
            <Label>Your name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div>
            <Label>Your email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>

          <div>
            <Label>Your phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional phone" />
          </div>

          <div>
            <Label>Message / Request</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your question or request" />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Message'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setName('')
                setEmail('')
                setPhone('')
                setMessage('')
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default LeadFormWithSelection
