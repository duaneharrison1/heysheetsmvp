import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

// Minimal dropdown menu implementation
const DropdownContext = React.createContext<any>(null)

const DropdownMenu = ({ children }: { children?: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const [triggerRef, setTriggerRef] = React.useState<HTMLElement | null>(null)
  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, setTriggerRef }}>
      {children}
    </DropdownContext.Provider>
  )
}

const DropdownMenuTrigger = ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => {
  const ctx = React.useContext(DropdownContext)
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (ref.current) {
      ctx.setTriggerRef(ref.current)
    }
  }, [ctx])

  if (!ctx) return null

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      ref,
      onClick: () => ctx.setOpen((v: boolean) => !v),
      'aria-expanded': ctx.open,
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx.setOpen((v: boolean) => !v)}
      aria-expanded={ctx.open}
    >
      {children}
    </button>
  )
}

const DropdownMenuPortal = ({ children }: { children?: React.ReactNode }) => {
  const el = typeof document !== "undefined" ? document.body : null
  if (!el) return <>{children}</>
  return createPortal(<>{children}</>, el)
}

const DropdownMenuContent = ({ className, children, align = 'start', sideOffset = 0 }: any) => {
  const ctx = React.useContext(DropdownContext)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })

  React.useEffect(() => {
    if (ctx.open && ctx.triggerRef && contentRef.current) {
      const triggerRect = ctx.triggerRef.getBoundingClientRect()
      const contentRect = contentRef.current.getBoundingClientRect()

      let top = triggerRect.bottom + sideOffset
      let left = triggerRect.left

      // Align positioning
      if (align === 'end') {
        left = triggerRect.right - contentRect.width
      } else if (align === 'center') {
        left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2)
      }

      // Keep within viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (left + contentRect.width > viewportWidth) {
        left = viewportWidth - contentRect.width - 10
      }
      if (left < 10) {
        left = 10
      }
      if (top + contentRect.height > viewportHeight) {
        top = triggerRect.top - contentRect.height - sideOffset
      }

      setPosition({ top, left })
    }
  }, [ctx.open, ctx.triggerRef, align, sideOffset])

  React.useEffect(() => {
    if (ctx.open) {
      const handleClickOutside = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node) &&
            ctx.triggerRef && !ctx.triggerRef.contains(e.target as Node)) {
          ctx.setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [ctx.open, ctx])

  if (!ctx) return null
  if (!ctx.open) return null

  return (
    <DropdownMenuPortal>
      <div
        ref={contentRef}
        style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px` }}
        className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}
      >
        {children}
      </div>
    </DropdownMenuPortal>
  )
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => (
    <button
      ref={ref}
      role="menuitem"
      className={cn("relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left", inset && "pl-8", className)}
      {...props}
    >
      {children}
    </button>
  )
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuCheckboxItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, onClick, ...props }, ref) => (
  <button
    ref={ref}
    role="menuitemcheckbox"
    aria-checked={checked}
    onClick={onClick}
    className={cn("relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-left", className)}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Check className="h-4 w-4" /> : null}</span>
    {children}
  </button>
))
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

const DropdownMenuRadioItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, onClick, ...props }, ref) => (
  <button
    ref={ref}
    role="menuitemradio"
    aria-checked={checked}
    onClick={onClick}
    className={cn("relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-left", className)}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Circle className="h-2 w-2 fill-current" /> : null}</span>
    {children}
  </button>
))
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

const DropdownMenuLabel = ({ className, inset, children, ...props }: any) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props}>{children}</div>
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = ({ className, ...props }: any) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
)
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

const DropdownMenuGroup = ({ children }: any) => <div>{children}</div>
const DropdownMenuSub = ({ children }: any) => <div>{children}</div>
const DropdownMenuSubContent = ({ children }: any) => <div>{children}</div>
const DropdownMenuSubTrigger = ({ children }: any) => <div>{children}</div>
const DropdownMenuRadioGroup = ({ children }: any) => <div role="radiogroup">{children}</div>

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
