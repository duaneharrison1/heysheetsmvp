import * as React from 'react'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, RotateCcw } from 'lucide-react'

// Field definition type for dynamic forms
interface FieldDefinition {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea'
  required?: boolean
  placeholder?: string
}

// Default fields if none provided
const DEFAULT_FIELDS: FieldDefinition[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Full name' },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel', required: false, placeholder: 'e.g. +1 555 555 5555' },
  { name: 'message', label: 'Message', type: 'textarea', required: false, placeholder: 'Short note or requirements' },
]

export const LeadForm: React.FC<{
  onSubmit?: (data: any) => void
  maxWidth?: string
  /** Force buttons to stack vertically regardless of viewport */
  stackButtons?: boolean
  /** Dynamic field definitions from spreadsheet schema */
  fields?: FieldDefinition[]
  /** Pre-filled values */
  defaultValues?: Record<string, string>
}> = ({ onSubmit, maxWidth, stackButtons, fields, defaultValues }) => {
  // Use dynamic fields or fall back to defaults
  const fieldDefs = fields && fields.length > 0 ? fields : DEFAULT_FIELDS

  // Initialize form state from field definitions
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    fieldDefs.forEach(f => {
      initial[f.name] = defaultValues?.[f.name] || ''
    })
    return initial
  })
  const [submitting, setSubmitting] = useState(false)

  // Update form data when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      setFormData(prev => ({
        ...prev,
        ...defaultValues
      }))
    }
  }, [defaultValues])

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      onSubmit?.(formData)
    } finally {
      // small delay to show submitting state in showcase
      setTimeout(() => setSubmitting(false), 400)
    }
  }

  const handleReset = () => {
    const resetData: Record<string, string> = {}
    fieldDefs.forEach(f => {
      resetData[f.name] = ''
    })
    setFormData(resetData)
  }

  const renderField = (field: FieldDefinition) => {
    const value = formData[field.name] || ''

    if (field.type === 'textarea') {
      return (
        <div key={field.name}>
          <Label>{field.label}{field.required && ' *'}</Label>
          <Textarea
            value={value}
            onChange={e => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      )
    }

    return (
      <div key={field.name}>
        <Label>{field.label}{field.required && ' *'}</Label>
        <Input
          type={field.type}
          value={value}
          onChange={e => handleFieldChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      </div>
    )
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
          {fieldDefs.map(renderField)}

          <div className={stackButtons ? 'flex flex-col gap-2' : 'flex flex-col md:flex-row gap-2'}>
            <Button type="submit" className={stackButtons ? 'w-full' : 'w-full md:flex-1'} disabled={submitting}>
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Sending...' : 'Send Message'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={stackButtons ? 'w-full' : 'w-full md:w-auto'}
              onClick={handleReset}
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
