import * as React from "react"
import { cn } from "@/lib/utils"

// A lightweight accessible select based on native <select> and <option>
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = "Select"

const SelectTrigger = Select

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ children, className, ...props }, ref) => (
  <option ref={ref} className={cn(className)} {...props}>
    {children}
  </option>
))
SelectItem.displayName = "SelectItem"

const SelectGroup = ({ children }: { children?: React.ReactNode }) => (
  <optgroup>{children}</optgroup>
)
SelectGroup.displayName = "SelectGroup"

const SelectValue = () => null

const SelectContent = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
)
SelectContent.displayName = "SelectContent"

const SelectLabel = ({ children, className, ...props }: any) => (
  <span className={cn("py-1.5 pl-2 pr-2 text-sm font-semibold", className)} {...props}>
    {children}
  </span>
)
SelectLabel.displayName = "SelectLabel"

const SelectSeparator = ({ className, ...props }: any) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)
SelectSeparator.displayName = "SelectSeparator"

const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
