import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import { ControlCenterPagesSection } from '~/Buttons/ControlCenterPages.js'
import { Button } from '~/Components/Button.js'

/**
 * PV fork: the "Control Center pages" screen (left menu, BUILD). Before this the list was only at the bottom of
 * Buttons → Pages tab, under the page list and the page templates, where it was easy to miss.
 */
export const ControlCenterPagesScreen = observer(function ControlCenterPagesScreen(): React.JSX.Element {
	const navigate = useNavigate()
	const [pageNumber, setPageNumberState] = useState(1)
	const [placed, setPlaced] = useState<number | null>(null)

	// After a place the screen offers to open that page in Buttons; picking a page in the list only selects it.
	const setPageNumber = useCallback((n: number) => setPageNumberState(n), [])
	const onPlaced = useCallback((n: number) => {
		setPageNumberState(n)
		setPlaced(n)
	}, [])

	return (
		<div className="cc-pages-screen">
			<ControlCenterPagesSection pageNumber={pageNumber} setPageNumber={setPageNumber} standalone onPlaced={onPlaced} />
			{placed != null && (
				<p className="cc-pages-open">
					<Button color="primary" size="sm" onClick={() => void navigate({ to: `/buttons/${placed}` })}>
						Open page {placed} in Buttons
					</Button>
				</p>
			)}
		</div>
	)
})
