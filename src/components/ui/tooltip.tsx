import * as React from "react"
import { cn } from "@/lib/utils"

// Simple hover-based tooltip (no portal)
const TooltipProvider = ({ children }: { children?: React.ReactNode; delayDuration?: number }) => <>{children}</>

const Tooltip = ({ children }: { children?: React.ReactNode }) => <>{children}</>

const TooltipTrigger = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { asChild?: boolean }>(
  ({ children, asChild, ...props }, forwardedRef) => {
    if (asChild && React.isValidElement(children)) {
      // clone without forwarding the `asChild` prop to the child DOM element
      return React.cloneElement(children, { ref: forwardedRef, ...props })
    }
    return (
      <span ref={forwardedRef as any} {...props}>
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: string; align?: string; hidden?: boolean }
>(({ className, children, hidden, ...props }, ref) => {
  if (hidden) return null
  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
