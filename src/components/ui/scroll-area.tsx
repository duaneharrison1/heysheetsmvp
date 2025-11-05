import * as React from "react"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("relative overflow-auto", className)} {...props}>
    <div className="h-full w-full rounded-[inherit]">{children}</div>
  </div>
))
ScrollArea.displayName = "ScrollArea"

type ScrollBarProps = React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "pointer-events-none",
      orientation === "vertical" ? "absolute right-0 top-0 h-full w-2" : "absolute left-0 bottom-0 h-2 w-full",
      className
    )}
    {...props}
  />
))
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
