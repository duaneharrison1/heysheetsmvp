import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const ContextMenuContext = React.createContext<any>(null)
const ContextMenu = ({ children }: { children?: React.ReactNode }) => {
	const [open, setOpen] = React.useState(false)
	const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
	return (
		<ContextMenuContext.Provider value={{ open, setOpen, pos, setPos }}>
			{children}
		</ContextMenuContext.Provider>
	)
}

const ContextMenuTrigger = ({ children }: { children?: React.ReactNode }) => {
	const ctx = React.useContext(ContextMenuContext)
	if (!ctx) return null
	return (
		<div
			onContextMenu={(e) => {
				e.preventDefault()
				ctx.setPos({ x: e.clientX, y: e.clientY })
				ctx.setOpen(true)
			}}
		>
			{children}
		</div>
	)
}

const ContextMenuPortal = ({ children }: { children?: React.ReactNode }) => {
	const el = typeof document !== "undefined" ? document.body : null
	if (!el) return <>{children}</>
	return createPortal(<>{children}</>, el)
}

const ContextMenuContent = ({ className, children }: any) => {
	const ctx = React.useContext(ContextMenuContext)
	if (!ctx) return null
	if (!ctx.open || !ctx.pos) return null

		const style = { left: ctx.pos.x, top: ctx.pos.y }

		return (
			<ContextMenuPortal>
				<div style={style} className={cn("fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}>
					{children}
				</div>
			</ContextMenuPortal>
		)
}

const ContextMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(
	({ className, inset, children, ...props }, ref) => (
		<button ref={ref} className={cn("relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left", inset && "pl-8", className)} {...props} />
	)
)
ContextMenuItem.displayName = "ContextMenuItem"

const ContextMenuCheckboxItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, onClick, ...props }, ref) => (
	<button ref={ref} role="menuitemcheckbox" aria-checked={checked} onClick={onClick} className={cn("relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-left", className)} {...props}>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Check className="h-4 w-4" /> : null}</span>
		{children}
	</button>
))
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem"

const ContextMenuRadioItem = React.forwardRef<HTMLButtonElement, any>(({ className, children, checked, onClick, ...props }, ref) => (
	<button ref={ref} role="menuitemradio" aria-checked={checked} onClick={onClick} className={cn("relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-left", className)} {...props}>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{checked ? <Circle className="h-2 w-2 fill-current" /> : null}</span>
		{children}
	</button>
))
ContextMenuRadioItem.displayName = "ContextMenuRadioItem"

const ContextMenuLabel = ({ className, inset, children, ...props }: any) => (
	<div className={cn("px-2 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className)} {...props}>{children}</div>
)
ContextMenuLabel.displayName = "ContextMenuLabel"

const ContextMenuSeparator = ({ className, ...props }: any) => <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
ContextMenuSeparator.displayName = "ContextMenuSeparator"

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
	<span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
)
ContextMenuShortcut.displayName = "ContextMenuShortcut"

const ContextMenuGroup = ({ children }: any) => <div>{children}</div>
const ContextMenuSub = ({ children }: any) => <div>{children}</div>
const ContextMenuSubContent = ({ children }: any) => <div>{children}</div>
const ContextMenuSubTrigger = ({ children }: any) => <div>{children}</div>
const ContextMenuRadioGroup = ({ children }: any) => <div role="radiogroup">{children}</div>

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup,
}

