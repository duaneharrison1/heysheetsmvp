import * as React from "react"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, checked, defaultChecked, children, ...props }, ref) => {
  return (
    <label className={cn("inline-flex items-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        defaultChecked={defaultChecked}
        checked={checked}
        {...props}
        className="sr-only peer"
      />

      <span
        aria-hidden
        className={cn(
          "inline-block h-6 w-11 rounded-full border-2 border-transparent transition-colors",
          "peer-checked:bg-primary peer-not-checked:bg-input",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transform transition-transform",
            "peer-checked:translate-x-5 peer-not-checked:translate-x-0"
          )}
        />
      </span>

      {children}
    </label>
  )
})

Switch.displayName = "Switch"

export { Switch }
