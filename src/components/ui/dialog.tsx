import * as React from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

// Minimal context-based dialog implementation (controlled via internal state)
const DialogContext = React.createContext<any>(null)

const Dialog = ({ children, open: controlledOpen, onOpenChange }: any) => {
  const [open, setOpen] = React.useState<boolean>(!!controlledOpen)

  React.useEffect(() => {
    if (typeof controlledOpen === "boolean") setOpen(controlledOpen)
  }, [controlledOpen])

  const value = React.useMemo(
    () => ({ open, setOpen, onOpenChange }),
    [open, onOpenChange]
  )

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

const DialogTrigger = ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => {
  const ctx = React.useContext(DialogContext)
  if (!ctx) return null

  const openDialog = (e?: React.MouseEvent) => {
    ctx.setOpen(true)
    ctx.onOpenChange?.(true)
  }

  // If asChild is true, clone the child element and attach the onClick handler
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement
    const existingOnClick = (child.props as any).onClick
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        try {
          existingOnClick?.(e)
        } catch (err) {
          // ignore
        }
        openDialog(e)
      },
    })
  }

  return (
    <button type="button" onClick={openDialog}>
      {children}
    </button>
  )
}

const DialogClose = ({ children }: { children?: React.ReactNode }) => {
  const ctx = React.useContext(DialogContext)
  if (!ctx) return null
  return (
    <button
      type="button"
      onClick={() => {
        ctx.setOpen(false)
        ctx.onOpenChange?.(false)
      }}
    >
      {children}
    </button>
  )
}

const DialogOverlay = ({ className, ...props }: any) => {
  return <div className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />
}

const DialogPortal = ({ children }: { children?: React.ReactNode }) => {
  const el = typeof document !== "undefined" ? document.body : null
  if (!el) return <>{children}</>
  return createPortal(<>{children}</>, el)
}

const DialogContent = ({ className, children, ...props }: any) => {
  const ctx = React.useContext(DialogContext)
  if (!ctx) return null

  if (!ctx.open) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
          className
        )}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div className="absolute right-4 top-4">
          <DialogClose>
            <button className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogClose>
        </div>
        {children}
      </div>
    </DialogPortal>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
