import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type AlertDialogContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null)

const useAlertDialog = () => {
  const ctx = React.useContext(AlertDialogContext)
  if (!ctx) throw new Error("AlertDialog components must be wrapped in <AlertDialog />")
  return ctx
}

const AlertDialog = ({ children, open: controlledOpen, onOpenChange }: { children?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [open, setOpen] = React.useState<boolean>(!!controlledOpen)

  React.useEffect(() => {
    if (typeof controlledOpen === "boolean") setOpen(controlledOpen)
  }, [controlledOpen])

  const setOpenWrapper = React.useCallback(
    (v: boolean) => {
      setOpen(v)
      onOpenChange?.(v)
    },
    [onOpenChange]
  )

  return <AlertDialogContext.Provider value={{ open, setOpen: setOpenWrapper }}>{children}</AlertDialogContext.Provider>
}

const AlertDialogTrigger = ({ children }: { children?: React.ReactNode }) => {
  const ctx = React.useContext(AlertDialogContext)
  if (!ctx) return null
  return (
    <button
      type="button"
      onClick={() => {
        ctx.setOpen(true)
      }}
    >
      {children}
    </button>
  )
}

const AlertDialogPortal = ({ children }: { children?: React.ReactNode }) => {
  const el = typeof document !== "undefined" ? document.body : null
  if (!el) return <>{children}</>
  return createPortal(<>{children}</>, el)
}

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { open } = useAlertDialog()
  if (!open) return null
  return <div ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />
})
AlertDialogOverlay.displayName = "AlertDialogOverlay"

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
  const { open } = useAlertDialog()
  if (!open) return null
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
          className
        )}
        role="alertdialog"
        aria-modal="true"
        {...props}
      >
        {children}
      </div>
    </AlertDialogPortal>
  )
})
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
))
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
AlertDialogDescription.displayName = "AlertDialogDescription"

const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => {
  const { setOpen } = useAlertDialog()
  return (
    <button
      ref={ref}
      {...props}
      onClick={(e) => {
        ;(props.onClick as any)?.(e)
        setOpen(false)
      }}
      className={cn(buttonVariants(), className)}
    >
      {children}
    </button>
  )
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => {
  const { setOpen } = useAlertDialog()
  return (
    <button
      ref={ref}
      {...props}
      onClick={(e) => {
        ;(props.onClick as any)?.(e)
        setOpen(false)
      }}
      className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    >
      {children}
    </button>
  )
})
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
