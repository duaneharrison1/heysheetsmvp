import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Simple accordion using <details> for accessibility
const Accordion = ({ children }: { children?: React.ReactNode }) => {
  return <div>{children}</div>
}

const AccordionItem = React.forwardRef<HTMLDetailsElement, React.HTMLAttributes<HTMLDetailsElement>>(({ className, children, ...props }, ref) => (
  <details ref={ref} className={cn("border-b", className)} {...props}>
    {children}
  </details>
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = ({ children, className, ...props }: any) => (
  <summary className={cn("flex cursor-pointer list-none items-center justify-between py-4 font-medium transition-all hover:underline", className)} {...props}>
    <span>{children}</span>
    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
  </summary>
)
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-hidden text-sm", className)} {...props}>
    {children}
  </div>
))
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
