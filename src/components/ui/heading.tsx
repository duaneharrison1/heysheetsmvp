import * as React from "react"
import { cn } from "@/lib/utils"

const H1 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h1 ref={ref} className={cn("text-3xl font-bold tracking-tight", className)} {...props} />
))
H1.displayName = 'H1'

const H2 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-2xl font-semibold", className)} {...props} />
))
H2.displayName = 'H2'

const Lead = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
Lead.displayName = 'Lead'

export { H1, H2, Lead }
