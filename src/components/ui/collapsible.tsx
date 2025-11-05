import * as React from "react"

const CollapsibleContext = React.createContext<any>(null)

const Collapsible = ({ children, open: controlledOpen, onOpenChange }: any) => {
	const [open, setOpen] = React.useState(!!controlledOpen)

	React.useEffect(() => {
		if (typeof controlledOpen === "boolean") setOpen(controlledOpen)
	}, [controlledOpen])

	return (
		<CollapsibleContext.Provider value={{ open, setOpen, onOpenChange }}>
			{children}
		</CollapsibleContext.Provider>
	)
}

const CollapsibleTrigger = ({ children }: { children?: React.ReactNode }) => {
	const ctx = React.useContext(CollapsibleContext)
	if (!ctx) return null
	return (
		<button
			type="button"
			onClick={() => {
				ctx.setOpen((o: boolean) => !o)
				ctx.onOpenChange?.(!ctx.open)
			}}
		>
			{children}
		</button>
	)
}

const CollapsibleContent = ({ children }: { children?: React.ReactNode }) => {
	const ctx = React.useContext(CollapsibleContext)
	if (!ctx) return null
	if (!ctx.open) return null
	return <div>{children}</div>
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
