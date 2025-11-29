import * as React from "react"
import { cn } from "@/lib/utils"

const CollapsibleContext = React.createContext<{
	open: boolean
	setOpen: React.Dispatch<React.SetStateAction<boolean>>
	onOpenChange?: (open: boolean) => void
} | null>(null)

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
	({ children, open: controlledOpen, defaultOpen = false, onOpenChange, className, ...props }, ref) => {
		const [open, setOpen] = React.useState(defaultOpen)
		const isControlled = controlledOpen !== undefined
		const isOpen = isControlled ? controlledOpen : open

		React.useEffect(() => {
			if (isControlled) setOpen(controlledOpen)
		}, [controlledOpen, isControlled])

		return (
			<CollapsibleContext.Provider value={{ open: isOpen, setOpen, onOpenChange }}>
				<div
					ref={ref}
					data-state={isOpen ? "open" : "closed"}
					className={className}
					{...props}
				>
					{children}
				</div>
			</CollapsibleContext.Provider>
		)
	}
)
Collapsible.displayName = "Collapsible"

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
	({ children, asChild, className, onClick, ...props }, ref) => {
		const ctx = React.useContext(CollapsibleContext)
		if (!ctx) return null

		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			const newOpen = !ctx.open
			ctx.setOpen(newOpen)
			ctx.onOpenChange?.(newOpen)
			onClick?.(e)
		}

		if (asChild && React.isValidElement(children)) {
			return React.cloneElement(children as React.ReactElement<any>, {
				onClick: handleClick,
				'data-state': ctx.open ? 'open' : 'closed',
			})
		}

		return (
			<button
				ref={ref}
				type="button"
				data-state={ctx.open ? "open" : "closed"}
				className={className}
				onClick={handleClick}
				{...props}
			>
				{children}
			</button>
		)
	}
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
	({ children, className, ...props }, ref) => {
		const ctx = React.useContext(CollapsibleContext)
		if (!ctx) return null
		if (!ctx.open) return null

		return (
			<div
				ref={ref}
				data-state={ctx.open ? "open" : "closed"}
				className={className}
				{...props}
			>
				{children}
			</div>
		)
	}
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
