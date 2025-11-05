import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const Popover = ({ children }: { children?: React.ReactNode }) => {
  return <div>{children}</div>
}

const PopoverTrigger = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) => (
  <button ref={ref as any} type="button" {...props}>
    {children}
  </button>
))
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; sideOffset?: number }
>(({ className, align = "center", sideOffset = 8, children, ...props }, ref) => {
  const [open, setOpen] = React.useState(true)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  // Basic positioning: position relative to triggering element if available via props.__triggerRef
  React.useLayoutEffect(() => {
    // Try to get trigger from props (caller may pass __triggerRef)
    const triggerRef = (props as any).__triggerRef as React.RefObject<HTMLElement> | undefined
    if (!triggerRef || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const top = rect.bottom + sideOffset + window.scrollY
    let left = rect.left + window.scrollX
    if (align === "center") left = rect.left + rect.width / 2 + window.scrollX
    if (align === "end") left = rect.right + window.scrollX
    setCoords({ top, left })
  }, [props, sideOffset, align])

  if (!open) return null

  const content = (
    <div
      ref={ref}
      className={cn("z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)}
      style={coords ? { position: "absolute", top: coords.top, left: coords.left, transform: align === "center" ? "translateX(-50%)" : undefined } : undefined}
      {...props}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
})
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
