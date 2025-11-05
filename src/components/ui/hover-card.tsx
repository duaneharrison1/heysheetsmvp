import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type HoverCardContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(
  null
)

const useHoverCard = () => {
  const ctx = React.useContext(HoverCardContext)
  if (!ctx) throw new Error("HoverCard components must be wrapped in <HoverCard />")
  return ctx
}

const HoverCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  return (
    <HoverCardContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("inline-block", className)} {...props}>
        {children}
      </div>
    </HoverCardContext.Provider>
  )
}

const HoverCardTrigger = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, ...props }, forwardedRef) => {
    const { setOpen, triggerRef } = useHoverCard()

    const ref = React.useRef<HTMLElement | null>(null)
    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLElement)

    const handleMouseEnter = () => setOpen(true)
    const handleMouseLeave = () => setOpen(false)
    const handleFocus = () => setOpen(true)
    const handleBlur = () => setOpen(false)

    return (
      <span
        ref={(el) => {
          ref.current = el
          // keep the shared triggerRef updated
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          triggerRef.current = el
        }}
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      >
        {children}
      </span>
    )
  }
)
HoverCardTrigger.displayName = "HoverCardTrigger"

const HoverCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; sideOffset?: number }
>(({ className, align = "center", sideOffset = 8, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useHoverCard()
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  React.useLayoutEffect(() => {
    if (!open) return setCoords(null)
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const top = rect.bottom + sideOffset + window.scrollY
    let left = rect.left + window.scrollX

    if (align === "center") {
      left = rect.left + rect.width / 2 + window.scrollX
    } else if (align === "end") {
      left = rect.right + window.scrollX
    }

    setCoords({ top, left })
  }, [open, sideOffset, align, triggerRef])

  if (!open) return null

  const content = (
    <div
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={cn(
        "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
        className
      )}
      style={coords ? { position: "absolute", top: coords.top, left: coords.left, transform: align === "center" ? "translateX(-50%)" : undefined } : undefined}
      {...props}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
})
HoverCardContent.displayName = "HoverCardContent"

export { HoverCard, HoverCardTrigger, HoverCardContent }
