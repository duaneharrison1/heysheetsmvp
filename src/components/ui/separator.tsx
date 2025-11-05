import * as React from "react"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement> & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "horizontal", ...props }, ref) => {
  if (orientation === "vertical") {
    return <div ref={ref as any} role="separator" aria-orientation="vertical" className={cn("shrink-0 bg-border h-full w-[1px]", className)} {...props} />
  }

  return <hr ref={ref as any} role="separator" aria-orientation="horizontal" className={cn("shrink-0 bg-border h-[1px] w-full", className)} {...props} />
})
Separator.displayName = "Separator"

export { Separator }
