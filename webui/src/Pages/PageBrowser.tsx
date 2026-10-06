import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'
import { getPageSurfaceLayout, type PageSurfaceCellKind } from '@companion-app/shared/PageSurfaceLayout.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './PageBrowser.css'

const SNAPSHOT_SIZE: PreviewRenderSize = { width: 36, height: 36 }

interface SnapshotCell {
	row: number
	column: number
	kind: PageSurfaceCellKind
	occupied: boolean
}

function cellsForPage(page: PagesStoreModel): SnapshotCell[] {
	const layout = getPageSurfaceLayout(page.surfaceLayout)
	if (layout) {
		return layout.cells.map((cell) => ({
			row: cell.row,
			column: cell.column,
			kind: cell.kind,
			occupied: Boolean(page.controls.get(cell.row)?.get(cell.column)),
		}))
	}

	let minRow = Infinity
	let maxRow = -Infinity
	let minColumn = Infinity
	let maxColumn = -Infinity
	let any = false
	for (const [row, columns] of page.controls.entries()) {
		for (const [column, controlId] of columns.entries()) {
			if (!controlId) continue
			any = true
			minRow = Math.min(minRow, row)
			maxRow = Math.max(maxRow, row)
			minColumn = Math.min(minColumn, column)
			maxColumn = Math.max(maxColumn, column)
		}
	}
	if (!any) return []

	const cells: SnapshotCell[] = []
	for (let row = minRow; row <= maxRow; row++) {
		for (let column = minColumn; column <= maxColumn; column++) {
			cells.push({
				row,
				column,
				kind: 'button',
				occupied: Boolean(page.controls.get(row)?.get(column)),
			})
		}
	}
	return cells
}

export const PageBrowser = observer(function PageBrowser(): React.JSX.Element {
	const { pages } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	return (
		<div className="page-browser">
			<h4>Pages</h4>
			<p>
				A picture of each page. The shape is the surface the page is written for, or just the buttons that are already
				there. Choose a page to edit it.
			</p>
			{pages.pageCount === 0 ? (
				<p>No pages yet.</p>
			) : (
				<div className="page-browser-cards">
					{pages.data.map((page, index) => (
						<PageCard
							key={page.id}
							pageNumber={index + 1}
							page={page}
							onOpen={(pageNumber) => {
								void navigate({ to: '/buttons/$page', params: { page: String(pageNumber) } })
							}}
						/>
					))}
				</div>
			)}
		</div>
	)
})

const PageCard = observer(function PageCard({
	pageNumber,
	page,
	onOpen,
}: {
	pageNumber: number
	page: PagesStoreModel
	onOpen: (pageNumber: number) => void
}): React.JSX.Element {
	const cells = cellsForPage(page)
	const layout = getPageSurfaceLayout(page.surfaceLayout)
	const bounds = cells.reduce(
		(box, cell) => ({
			minRow: Math.min(box.minRow, cell.row),
			maxRow: Math.max(box.maxRow, cell.row),
			minColumn: Math.min(box.minColumn, cell.column),
			maxColumn: Math.max(box.maxColumn, cell.column),
		}),
		{ minRow: Infinity, maxRow: -Infinity, minColumn: Infinity, maxColumn: -Infinity }
	)
	const columns = cells.length === 0 ? 0 : bounds.maxColumn - bounds.minColumn + 1
	const rows = cells.length === 0 ? 0 : bounds.maxRow - bounds.minRow + 1
	const title = page.name?.trim() ? page.name : `Page ${pageNumber}`

	return (
		<button type="button" className="page-browser-card" onClick={() => onOpen(pageNumber)}>
			<div className="page-browser-card-heading">
				<span className="page-browser-number">{pageNumber}</span>
				<span className="page-browser-title">{title}</span>
			</div>
			<div className="page-browser-surface">{layout ? `${layout.label} · ${layout.summary}` : 'Full grid'}</div>
			{cells.length === 0 ? (
				<div className="page-browser-empty">Empty page</div>
			) : (
				<div
					className="page-browser-snapshot"
					style={{
						gridTemplateColumns: `repeat(${columns}, 22px)`,
						gridTemplateRows: `repeat(${rows}, 22px)`,
					}}
				>
					{cells.map((cell) => (
						<PageSnapshotCell
							key={`${cell.row}/${cell.column}`}
							pageNumber={pageNumber}
							cell={cell}
							minRow={bounds.minRow}
							minColumn={bounds.minColumn}
						/>
					))}
				</div>
			)}
		</button>
	)
})

function PageSnapshotCell({
	pageNumber,
	cell,
	minRow,
	minColumn,
}: {
	pageNumber: number
	cell: SnapshotCell
	minRow: number
	minColumn: number
}): React.JSX.Element {
	const location: ControlLocation = { pageNumber, row: cell.row, column: cell.column }
	const image = useButtonImageForLocation(location, SNAPSHOT_SIZE, !cell.occupied)
	const tag = cell.kind === 'encoder' ? 'Knob' : cell.kind === 'touch' ? 'Touch' : cell.kind === 'tbar' ? 'T-bar' : ''

	return (
		<div
			className="page-browser-cell"
			data-kind={cell.kind}
			title={tag || undefined}
			style={{
				gridColumn: cell.column - minColumn + 1,
				gridRow: cell.row - minRow + 1,
			}}
		>
			{image.image ? <img src={image.image} alt="" /> : null}
		</div>
	)
}
