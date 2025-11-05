import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, children, ...props }, ref) => (
  <label className={cn("inline-flex items-center gap-2", className)}>
    <input
      ref={ref}
      type="checkbox"
      {...props}
      className="peer sr-only"
    />

    <span
      aria-hidden
      className={cn(
        "grid place-content-center h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 peer-checked:bg-primary peer-checked:text-primary-foreground",
        "transition-colors",
      )}
    >
      <Check className="h-4 w-4 opacity-0 peer-checked:opacity-100" />
    </span>

    {children}
  </label>
))

Checkbox.displayName = "Checkbox"

export { Checkbox }
