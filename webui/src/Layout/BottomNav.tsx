import './BottomNav.css'
import { faClock, faEllipsis, faGamepad, faPlug, faTableCells } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useMatchRoute } from '@tanstack/react-router'
import classNames from 'classnames'
import { useEffect, useRef, useState } from 'react'
import { useMobileMode } from '~/Hooks/useLayoutMode.js'
import { useSidebarState } from './Sidebar.js'

/**
 * Phone and tablet navigation. The sidebar is an overlay at this width, so the five destinations
 * stay on screen. More opens that overlay for everything else.
 */
export function BottomNav(): React.JSX.Element | null {
	const mobileMode = useMobileMode()
	const { handleShowSidebar } = useSidebarState()
	const matchRoute = useMatchRoute()
	const [automateOpen, setAutomateOpen] = useState(false)
	const automateRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!automateOpen) return
		const close = (event: PointerEvent) => {
			if (!automateRef.current?.contains(event.target as Node)) setAutomateOpen(false)
		}
		window.addEventListener('pointerdown', close)
		return () => window.removeEventListener('pointerdown', close)
	}, [automateOpen])

	if (!mobileMode) return null

	const onButtons = !!matchRoute({ to: '/buttons', fuzzy: true }) || !!matchRoute({ to: '/pages', fuzzy: true })
	const onConnections = !!matchRoute({ to: '/connections', fuzzy: true })
	const onSurfaces = !!matchRoute({ to: '/surfaces', fuzzy: true })
	const onAutomate = !!matchRoute({ to: '/triggers', fuzzy: true }) || !!matchRoute({ to: '/variables', fuzzy: true })

	return (
		<nav className="bottom-nav" aria-label="Primary">
			<BottomNavLink to="/buttons" icon={faTableCells} label="Buttons" active={onButtons} />
			<BottomNavLink to="/connections" icon={faPlug} label="Connections" active={onConnections} />
			<BottomNavLink to="/surfaces" icon={faGamepad} label="Surfaces" active={onSurfaces} />
			<div className="bottom-nav-slot" ref={automateRef}>
				<button
					type="button"
					className={classNames('bottom-nav-link', { active: onAutomate || automateOpen })}
					aria-expanded={automateOpen}
					onClick={() => setAutomateOpen((open) => !open)}
				>
					<FontAwesomeIcon icon={faClock} />
					<span>Automate</span>
				</button>
				{automateOpen && (
					<div className="bottom-nav-menu" role="menu">
						<Link to="/triggers" role="menuitem" onClick={() => setAutomateOpen(false)}>
							Triggers
						</Link>
						<Link to="/variables" role="menuitem" onClick={() => setAutomateOpen(false)}>
							Variables
						</Link>
					</div>
				)}
			</div>
			<button type="button" className="bottom-nav-link" onClick={handleShowSidebar}>
				<FontAwesomeIcon icon={faEllipsis} />
				<span>More</span>
			</button>
		</nav>
	)
}

function BottomNavLink({
	to,
	icon,
	label,
	active,
}: {
	to: string
	icon: typeof faPlug
	label: string
	active: boolean
}): React.JSX.Element {
	return (
		<Link to={to} className={classNames('bottom-nav-link', { active })}>
			<FontAwesomeIcon icon={icon} />
			<span>{label}</span>
		</Link>
	)
}
