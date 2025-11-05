import * as React from "react"

const AspectRatio = ({ ratio = 1, children, className, style, ...props }: { ratio?: number; children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => {
	const padding = `${(1 / ratio) * 100}%`
	return (
		<div className={className} style={{ position: "relative", ...style }} {...props}>
			<div style={{ width: "100%", paddingTop: padding }} />
			<div style={{ position: "absolute", inset: 0 }}>{children}</div>
		</div>
	)
}

export { AspectRatio }
