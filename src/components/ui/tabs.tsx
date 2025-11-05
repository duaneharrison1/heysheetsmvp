import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string | null
  onValueChange?: (v: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

const Tabs = ({ children, defaultValue, value, onValueChange }: any) => {
  const [internal, setInternal] = React.useState<string | null>(defaultValue ?? null)

  const ctx: TabsContextValue = React.useMemo(
    () => ({ value: value ?? internal, onValueChange: onValueChange ?? ((v) => setInternal(v)) }),
    [value, internal, onValueChange]
  )

  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} role="tablist" className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props} />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(({ className, value, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  if (!ctx) return null

  const active = ctx.value === value

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onValueChange?.(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        active && "bg-background text-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
TabsTrigger.displayName = "TabsTrigger"

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & { value?: string }

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  if (!ctx) return null
  if (ctx.value !== value) return null
  return (
    <div ref={ref} role="tabpanel" className={cn("mt-2", className)} {...props}>
      {children}
    </div>
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
