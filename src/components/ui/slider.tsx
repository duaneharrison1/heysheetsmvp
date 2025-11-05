import * as React from "react"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="range"
      className={cn(
        "relative h-2 w-full appearance-none bg-secondary rounded-full",
        className
      )}
      {...props}
    />
  )
})
Slider.displayName = "Slider"

export { Slider }
