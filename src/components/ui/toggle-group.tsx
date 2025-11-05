import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

type ToggleGroupType = "single" | "multiple"

type ToggleGroupContextValue = {
  type: ToggleGroupType
  value: string | string[] | undefined
  onValueChange?: (v: string | string[] | undefined) => void
  variant?: VariantProps<typeof toggleVariants>["variant"]
  size?: VariantProps<typeof toggleVariants>["size"]
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof toggleVariants> & {
      type?: ToggleGroupType
      value?: string | string[]
      defaultValue?: string | string[]
      onValueChange?: (v: string | string[] | undefined) => void
    }
>(({ className, variant, size, children, type = "single", value, defaultValue, onValueChange, ...props }, ref) => {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState<string | string[] | undefined>(defaultValue)

  const currentValue = isControlled ? value : internalValue

  const handleChange = (next: string | string[] | undefined) => {
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <div ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props}>
      <ToggleGroupContext.Provider value={{ type, value: currentValue, onValueChange: handleChange, variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </div>
  )
})
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof toggleVariants> & { value: string; asChild?: boolean }
>(({ className, children, variant, size, value, asChild, ...props }, ref) => {
  const ctx = React.useContext(ToggleGroupContext)
  const isSelected = React.useMemo(() => {
    if (!ctx) return false
    if (ctx.type === "multiple") return Array.isArray(ctx.value) && ctx.value.includes(value)
    return ctx.value === value
  }, [ctx, value])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // ensure the typed onClick is called with HTMLButtonElement event
    ;(props.onClick as React.MouseEventHandler<HTMLButtonElement>)?.(e)
    if (!ctx) return
    if (ctx.type === "multiple") {
      const arr = Array.isArray(ctx.value) ? [...ctx.value] : []
      const idx = arr.indexOf(value)
      if (idx === -1) arr.push(value)
      else arr.splice(idx, 1)
      ctx.onValueChange?.(arr)
    } else {
      ctx.onValueChange?.(isSelected ? undefined : value)
    }
  }

  const classes = cn(toggleVariants({ variant: ctx?.variant || variant, size: ctx?.size || size }), className)

  if (asChild && React.isValidElement(children)) {
    // Clone child and inject props
    // @ts-ignore
    return React.cloneElement(children, { ref, role: "button", "aria-pressed": isSelected, className: cn((children as any).props.className, classes), onClick: handleClick, ...props })
  }

  return (
    <button ref={ref} role="button" aria-pressed={isSelected} className={classes} onClick={handleClick} {...props}>
      {children}
    </button>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
