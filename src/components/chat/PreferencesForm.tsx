import * as React from 'react'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectItem } from '@/components/ui/select'
import { Sparkles, RotateCcw } from 'lucide-react'

// Field definition type for preferences
interface SelectOption {
  value: string
  label: string
}

interface FieldDefinition {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  options?: SelectOption[]
}

// Default fields if none provided
const DEFAULT_FIELDS: FieldDefinition[] = [
  {
    name: 'goal',
    label: 'What are you looking for?',
    type: 'textarea',
    required: true,
    placeholder: 'Tell us what you\'re interested in or what you\'d like to achieve...'
  },
  {
    name: 'experience_level',
    label: 'Experience Level',
    type: 'select',
    required: false,
    options: [
      { value: 'beginner', label: 'Beginner - New to this' },
      { value: 'intermediate', label: 'Intermediate - Some experience' },
      { value: 'advanced', label: 'Advanced - Very experienced' },
      { value: 'any', label: 'No preference' }
    ]
  },
  {
    name: 'budget',
    label: 'Budget Range',
    type: 'select',
    required: false,
    options: [
      { value: 'low', label: 'Budget-friendly' },
      { value: 'medium', label: 'Mid-range' },
      { value: 'high', label: 'Premium' },
      { value: 'any', label: 'No preference' }
    ]
  },
  {
    name: 'time_preference',
    label: 'Preferred Time',
    type: 'select',
    required: false,
    options: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'any', label: 'No preference' }
    ]
  }
]

export const PreferencesForm: React.FC<{
  onSubmit?: (data: any) => void
  maxWidth?: string
  /** Dynamic field definitions */
  fields?: FieldDefinition[]
  /** Pre-filled values */
  defaultValues?: Record<string, string>
  /** Form title */
  title?: string
  /** Form subtitle */
  subtitle?: string
}> = ({ onSubmit, maxWidth, fields, defaultValues, title, subtitle }) => {
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
      // Filter out empty values and 'any' selections
      const cleanedData: Record<string, string> = {}
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value !== 'any' && value.trim() !== '') {
          cleanedData[key] = value
        }
      })
      onSubmit?.(cleanedData)
    } finally {
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
        <div key={field.name} className="space-y-1.5">
          <Label className="text-sm font-medium">{field.label}{field.required && ' *'}</Label>
          <Textarea
            value={value}
            onChange={e => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="min-h-[80px] resize-none"
          />
        </div>
      )
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label className="text-sm font-medium">{field.label}{field.required && ' *'}</Label>
          <Select
            value={value || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          >
            <SelectItem value="">Select an option...</SelectItem>
            {field.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>
      )
    }

    return null
  }

  return (
    <Card
      className={`w-full ${maxWidth ? '' : 'mx-auto max-w-full sm:max-w-md'} border border-border shadow-sm`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-3 p-3 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            {title || 'Get Personalized Recommendations'}
          </h3>
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0 p-3 sm:p-6 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldDefs.map(renderField)}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
              <Sparkles className="w-4 h-4 mr-2" />
              {submitting ? 'Finding matches...' : 'Get Recommendations'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
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

export default PreferencesForm
