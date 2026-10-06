import type { UserConfigGridSize } from './Model/UserConfigModel.js'

/**
 * Surfaces a page can be written for.
 *
 * Coordinates are the same row and column the Elgato driver reports, with the origin at the
 * home corner of the grid. A surface sitting at offset 0,0 then shows these cells on the
 * matching keys, touch regions, and knobs.
 */
export const PAGE_SURFACE_LAYOUT_IDS = [
	'streamdeck',
	'streamdeck-xl',
	'streamdeck-plus',
	'streamdeck-plus-xl',
	'atem-micro',
] as const

export type PageSurfaceLayoutId = (typeof PAGE_SURFACE_LAYOUT_IDS)[number]

/** What a cell on the device is. A hole is simply a missing cell. The T-bar is one cell, not a span. */
export type PageSurfaceCellKind = 'button' | 'touch' | 'encoder' | 'tbar'

export interface PageSurfaceCell {
	row: number
	column: number
	kind: PageSurfaceCellKind
}

export interface PageSurfaceLayout {
	id: PageSurfaceLayoutId
	label: string
	/** One line under the name in the page settings */
	summary: string
	/**
	 * Anything the user should know that the grid picture does not say on its own.
	 * Empty when the layout is just a rectangle of keys.
	 */
	note: string
	/** Inclusive rectangle the grid has to cover for every cell to exist */
	bounds: UserConfigGridSize
	cells: readonly PageSurfaceCell[]
	/** `${row}/${column}` for every cell, so a hole can be told from a control */
	cellKeys: ReadonlySet<string>
	cellsByKey: ReadonlyMap<string, PageSurfaceCell>
}

export function pageSurfaceCellKey(row: number, column: number): string {
	return `${row}/${column}`
}

function buttons(columns: number, rows: number): PageSurfaceCell[] {
	const cells: PageSurfaceCell[] = []
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			cells.push({ row, column, kind: 'button' })
		}
	}
	return cells
}

function cellsAt(row: number, columns: readonly number[], kind: PageSurfaceCellKind): PageSurfaceCell[] {
	return columns.map((column) => ({ row, column, kind }))
}

/**
 * ATEM Micro Panel keys, in the same row and column the Blackmagic controller reports.
 * The T-bar occupies row 0 column 14 for its whole height; the cells under it are holes,
 * because a surface layout stores one cell per coordinate rather than a span.
 */
function atemMicroCells(): PageSurfaceCell[] {
	const range = (from: number, to: number): number[] => {
		const columns: number[] = []
		for (let column = from; column <= to; column++) columns.push(column)
		return columns
	}

	return [
		...cellsAt(0, range(5, 13), 'button'),
		...cellsAt(1, [...range(5, 9), ...range(11, 13), 15, 16], 'button'),
		...cellsAt(2, [...range(0, 13), 15, 16], 'button'),
		...cellsAt(3, [...range(0, 11), 13, 15, 16], 'button'),
		{ row: 0, column: 14, kind: 'tbar' },
	]
}

function finishLayout(layout: Omit<PageSurfaceLayout, 'bounds' | 'cellKeys' | 'cellsByKey'>): PageSurfaceLayout {
	let minColumn = Infinity
	let maxColumn = -Infinity
	let minRow = Infinity
	let maxRow = -Infinity
	const cellKeys = new Set<string>()
	const cellsByKey = new Map<string, PageSurfaceCell>()

	for (const cell of layout.cells) {
		minColumn = Math.min(minColumn, cell.column)
		maxColumn = Math.max(maxColumn, cell.column)
		minRow = Math.min(minRow, cell.row)
		maxRow = Math.max(maxRow, cell.row)
		const key = pageSurfaceCellKey(cell.row, cell.column)
		cellKeys.add(key)
		cellsByKey.set(key, cell)
	}

	return {
		...layout,
		bounds: { minColumn, maxColumn, minRow, maxRow },
		cellKeys,
		cellsByKey,
	}
}

/**
 * Stream Deck + XL encoders do not sit on every key column. The driver places the six knobs,
 * and the touch-strip cells above them, on these columns of the 9-wide key grid.
 */
export const STREAM_DECK_PLUS_XL_ENCODER_COLUMNS = [0, 2, 3, 5, 6, 8] as const

export const PAGE_SURFACE_LAYOUTS: readonly PageSurfaceLayout[] = [
	finishLayout({
		id: 'streamdeck',
		label: 'Stream Deck',
		summary: '5 columns × 3 rows',
		note: '',
		cells: buttons(5, 3),
	}),
	finishLayout({
		id: 'streamdeck-xl',
		label: 'Stream Deck XL',
		summary: '8 columns × 4 rows',
		note: '',
		cells: buttons(8, 4),
	}),
	finishLayout({
		id: 'streamdeck-plus',
		label: 'Stream Deck +',
		summary: '4×2 keys, touch strip, a knob under each column',
		note: 'Keys are the top two rows. The row under the keys is the touch strip, and the row under that is a knob for each column.',
		cells: [...buttons(4, 2), ...cellsAt(2, [0, 1, 2, 3], 'touch'), ...cellsAt(3, [0, 1, 2, 3], 'encoder')],
	}),
	finishLayout({
		id: 'streamdeck-plus-xl',
		label: 'Stream Deck + XL',
		summary: '9×4 keys, touch strip, 6 knobs that are not under every key',
		note: 'Keys fill the top four rows. The touch strip and the six knobs sit on the same columns as each other, with a gap under the 2nd, 5th, and 8th keys. A knob is not under every key.',
		cells: [
			...buttons(9, 4),
			...cellsAt(4, STREAM_DECK_PLUS_XL_ENCODER_COLUMNS, 'touch'),
			...cellsAt(5, STREAM_DECK_PLUS_XL_ENCODER_COLUMNS, 'encoder'),
		],
	}),
	finishLayout({
		id: 'atem-micro',
		label: 'ATEM Micro Panel',
		summary: '17 columns × 4 rows, with gaps and a T-bar',
		note: 'Coordinates match the ATEM Micro Panel, including the empty spots. The T-bar is the single cell at row 1, column 15. This layout is wider than the usual grid, so saving it grows the shared button grid to 17 columns for every page. The panel lines up when it sits at the home corner.',
		cells: atemMicroCells(),
	}),
]

const LAYOUTS_BY_ID = new Map<PageSurfaceLayoutId, PageSurfaceLayout>(
	PAGE_SURFACE_LAYOUTS.map((layout) => [layout.id, layout])
)

export function isPageSurfaceLayoutId(id: string | null | undefined): id is PageSurfaceLayoutId {
	return !!id && LAYOUTS_BY_ID.has(id as PageSurfaceLayoutId)
}

export function getPageSurfaceLayout(id: string | null | undefined): PageSurfaceLayout | null {
	if (!id) return null
	return LAYOUTS_BY_ID.get(id as PageSurfaceLayoutId) ?? null
}

/**
 * Grow `current` so every cell of `layout` is on the grid. Returns null when it already fits.
 * The grid is shared by every page, so growing it adds empty rows and columns to the others.
 */
export function gridGrowthForLayout(current: UserConfigGridSize, layout: PageSurfaceLayout): UserConfigGridSize | null {
	const needed = layout.bounds
	const next: UserConfigGridSize = {
		minColumn: Math.min(current.minColumn, needed.minColumn),
		maxColumn: Math.max(current.maxColumn, needed.maxColumn),
		minRow: Math.min(current.minRow, needed.minRow),
		maxRow: Math.max(current.maxRow, needed.maxRow),
	}

	if (
		next.minColumn === current.minColumn &&
		next.maxColumn === current.maxColumn &&
		next.minRow === current.minRow &&
		next.maxRow === current.maxRow
	) {
		return null
	}

	return next
}

/**
 * The image-library variable a stored page image points at, or null when it is empty or an inline image.
 * Stored page images are either `$(image:name)` or a `data:image/...` URL.
 */
export function pageImageVariableId(image: string | null | undefined): string | null {
	if (!image) return null
	const match = /^\$\(image:([^)\s]+)\)$/.exec(image)
	return match ? `image:${match[1]}` : null
}

/**
 * Where keyboard focus goes from this cell.
 *
 * Holes are skipped. Stepping off an edge wraps on that axis, the same way the full grid does,
 * and lands on the next real cell rather than on a gap.
 */
export function stepPageSurfaceFocus(
	from: { row: number; column: number },
	rowDelta: number,
	columnDelta: number,
	layout: PageSurfaceLayout
): { row: number; column: number } | null {
	if (rowDelta === 0 && columnDelta === 0) return { row: from.row, column: from.column }

	const { minRow, maxRow, minColumn, maxColumn } = layout.bounds
	let row = from.row
	let column = from.column
	const seen = new Set<string>()

	// One more step than there are cells in the rectangle, so a full lap is noticed
	const limit = (maxRow - minRow + 1) * (maxColumn - minColumn + 1) + 1

	for (let i = 0; i < limit; i++) {
		row += rowDelta
		column += columnDelta

		if (row > maxRow) row = minRow
		else if (row < minRow) row = maxRow

		if (column > maxColumn) column = minColumn
		else if (column < minColumn) column = maxColumn

		if (row === from.row && column === from.column) return null

		const key = pageSurfaceCellKey(row, column)
		if (seen.has(key)) return null
		seen.add(key)

		if (layout.cellKeys.has(key)) return { row, column }
	}

	return null
}
