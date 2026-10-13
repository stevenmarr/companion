import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import type { MouseEventHandler } from 'react'
import { useSidebarState } from './Sidebar'
import { useCompanionVersion } from './useCompanionVersion'

export function SidebarHeader(): React.JSX.Element {
	return (
		<div className="sidebar-header brand">
			<div className="sidebar-brand">
				<div className="sidebar-brand-full">Performance Video LLC</div>
				<div className="sidebar-brand-narrow">PV</div>
			</div>
		</div>
	)
}

export interface SidebarFooterProps {
	onContextMenu: MouseEventHandler<HTMLDivElement>
}

export const SidebarFooter = observer(function SidebarFooter({ onContextMenu }: SidebarFooterProps): React.JSX.Element {
	const { versionName, versionBuild: versionSubheading } = useCompanionVersion()
	const { mobileMode } = useSidebarState()

	return (
		<div className="sidebar-footer2 flex">
			<div className="nav-link sidebar-footer-toggler">
				{mobileMode ? (
					<span className={'nav-icon-wrapper flex block-collapse'} onMouseUp={onContextMenu}>
						<FontAwesomeIcon className="nav-icon opacity-50" icon={faCog} />
					</span>
				) : (
					<span
						className={classNames('nav-icon-wrapper', mobileMode ? 'hidden' : 'flex')}
						onClick={onContextMenu}
						onContextMenu={onContextMenu}
						title="Click for more sidebar options"
					>
						<span className="nav-icon sidebar-toggler"></span>
					</span>
				)}

				<span className="flex-auto truncate">
					<span className="version">{versionName || 'Unknown'}</span>
					{/* <br /> */}
					<span className="version-sub">{versionSubheading}</span>
				</span>
			</div>
		</div>
	)
})
