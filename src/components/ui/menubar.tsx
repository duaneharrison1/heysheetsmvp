import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const Menubar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-10 items-center space-x-1 rounded-md border bg-background p-1", className)} {...props}>
    {children}
  </div>
))
Menubar.displayName = "Menubar"

const MenubarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => (
  <button ref={ref} className={cn("flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
    {children}
  </button>
))
MenubarTrigger.displayName = "MenubarTrigger"

const MenubarSubTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(({ className, inset, children, ...props }, ref) => (
  <button ref={ref} className={cn("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground", inset && "pl-8", className)} {...props}>
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </button>
))
MenubarSubTrigger.displayName = "MenubarSubTrigger"

const MenubarSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground", className)} {...props} />
))
MenubarSubContent.displayName = "MenubarSubContent"

type MenubarContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end"
  alignOffset?: number
  sideOffset?: number
}

const MenubarContent = React.forwardRef<HTMLDivElement, MenubarContentProps>(({ className, align = "start", alignOffset = -4, sideOffset = 8, children, ...props }, ref) => {
  // simplified: just portal the content
  const el = typeof document !== "undefined" ? document.body : null
  if (!el) return null
  return createPortal(
    <div ref={ref as any} className={cn("z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props}>
      {children}
    </div>,
    el
  )
})
MenubarContent.displayName = "MenubarContent"

const MenubarItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(({ className, inset, ...props }, ref) => (
  <button ref={ref} className={cn("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground", inset && "pl-8", className)} {...props} />
))
MenubarItem.displayName = "MenubarItem"

const MenubarCheckboxItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, ...props }, ref) => (
  <button ref={ref} role="menuitemcheckbox" aria-checked={checked} className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Check className="h-4 w-4" /> : null}</span>
    {children}
  </button>
))
MenubarCheckboxItem.displayName = "MenubarCheckboxItem"

const MenubarRadioItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, ...props }, ref) => (
  <button ref={ref} role="menuitemradio" aria-checked={checked} className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Circle className="h-2 w-2 fill-current" /> : null}</span>
    {children}
  </button>
))
MenubarRadioItem.displayName = "MenubarRadioItem"

const MenubarLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(({ className, inset, ...props }, ref) => (
  <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
))
MenubarLabel.displayName = "MenubarLabel"

const MenubarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
))
MenubarSeparator.displayName = "MenubarSeparator"

const MenubarShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
}
MenubarShortcut.displayName = "MenubarShortcut"

const MenubarMenu = ({ children }: any) => <div>{children}</div>
const MenubarGroup = ({ children }: any) => <div>{children}</div>
const MenubarPortal = ({ children }: any) => <>{children}</>
const MenubarSub = ({ children }: any) => <div>{children}</div>
const MenubarRadioGroup = ({ children }: any) => <div role="radiogroup">{children}</div>

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}
