import * as React from "react"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

type RadioGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  name?: string
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(({ className, children, name, value, defaultValue, onValueChange, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("grid gap-2", className)} {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child, { name, onChange: (e: any) => onValueChange?.(e.target.value), defaultChecked: child.props.value === defaultValue, checked: value ? child.props.value === value : undefined })
      })}
    </div>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, children, ...props }, ref) => {
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <input ref={ref} type="radio" {...props} className="sr-only" />
      <span className={cn("inline-block h-4 w-4 rounded-full border border-primary bg-background flex items-center justify-center")}>{props.checked || props.defaultChecked ? <Circle className="h-2.5 w-2.5 fill-current" /> : null}</span>
      {children}
    </label>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
