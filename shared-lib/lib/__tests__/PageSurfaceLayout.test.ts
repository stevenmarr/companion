import { describe, expect, test } from 'vitest'
import {
	getPageSurfaceLayout,
	gridGrowthForLayout,
	pageImageVariableId,
	stepPageSurfaceFocus,
	STREAM_DECK_PLUS_XL_ENCODER_COLUMNS,
} from '../PageSurfaceLayout.js'

function cellsOf(id: string, kind: 'button' | 'touch' | 'encoder'): string[] {
	const layout = getPageSurfaceLayout(id)
	if (!layout) throw new Error(`missing ${id}`)
	return layout.cells.filter((cell) => cell.kind === kind).map((cell) => `${cell.row}/${cell.column}`)
}

describe('page surface layouts', () => {
	test('a Stream Deck is 5 columns by 3 rows of keys', () => {
		const layout = getPageSurfaceLayout('streamdeck')
		expect(layout?.bounds).toEqual({ minColumn: 0, maxColumn: 4, minRow: 0, maxRow: 2 })
		expect(cellsOf('streamdeck', 'button')).toHaveLength(15)
		expect(cellsOf('streamdeck', 'encoder')).toEqual([])
		expect(layout?.cellKeys.has('0/4')).toBe(true)
		expect(layout?.cellKeys.has('0/5')).toBe(false)
	})

	test('a Stream Deck XL is 8 columns by 4 rows of keys', () => {
		const layout = getPageSurfaceLayout('streamdeck-xl')
		expect(layout?.bounds).toEqual({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })
		expect(cellsOf('streamdeck-xl', 'button')).toHaveLength(32)
		expect(cellsOf('streamdeck-xl', 'encoder')).toEqual([])
	})

	test('a Stream Deck + puts a knob under each of the 4 columns', () => {
		expect(cellsOf('streamdeck-plus', 'button')).toEqual(['0/0', '0/1', '0/2', '0/3', '1/0', '1/1', '1/2', '1/3'])
		expect(cellsOf('streamdeck-plus', 'touch')).toEqual(['2/0', '2/1', '2/2', '2/3'])
		expect(cellsOf('streamdeck-plus', 'encoder')).toEqual(['3/0', '3/1', '3/2', '3/3'])
	})

	test('a Stream Deck + XL does not put a knob under every key', () => {
		const layout = getPageSurfaceLayout('streamdeck-plus-xl')
		expect(layout?.bounds).toEqual({ minColumn: 0, maxColumn: 8, minRow: 0, maxRow: 5 })
		expect(cellsOf('streamdeck-plus-xl', 'button')).toHaveLength(36)

		const knobColumns = cellsOf('streamdeck-plus-xl', 'encoder').map((key) => Number(key.split('/')[1]))
		expect(knobColumns).toEqual([...STREAM_DECK_PLUS_XL_ENCODER_COLUMNS])
		expect(cellsOf('streamdeck-plus-xl', 'touch').map((key) => Number(key.split('/')[1]))).toEqual([
			...STREAM_DECK_PLUS_XL_ENCODER_COLUMNS,
		])

		// Gaps under the 2nd, 5th, and 8th keys (columns 1, 4, and 7)
		for (const column of [1, 4, 7]) {
			expect(layout?.cellKeys.has(`4/${column}`)).toBe(false)
			expect(layout?.cellKeys.has(`5/${column}`)).toBe(false)
			expect(layout?.cellKeys.has(`0/${column}`)).toBe(true)
		}
	})

	test('an unknown layout is ignored', () => {
		expect(getPageSurfaceLayout(null)).toBeNull()
		expect(getPageSurfaceLayout('streamdeck-studio')).toBeNull()
	})

	test('the shared grid grows only when the layout does not fit', () => {
		const standard = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
		expect(gridGrowthForLayout(standard, getPageSurfaceLayout('streamdeck-xl')!)).toBeNull()
		expect(gridGrowthForLayout(standard, getPageSurfaceLayout('streamdeck-plus-xl')!)).toEqual({
			minColumn: 0,
			maxColumn: 8,
			minRow: 0,
			maxRow: 5,
		})
	})

	test('keyboard focus skips the gaps between + XL knobs and wraps the row', () => {
		const layout = getPageSurfaceLayout('streamdeck-plus-xl')!
		expect(stepPageSurfaceFocus({ row: 5, column: 0 }, 0, 1, layout)).toEqual({ row: 5, column: 2 })
		expect(stepPageSurfaceFocus({ row: 5, column: 3 }, 0, 1, layout)).toEqual({ row: 5, column: 5 })
		expect(stepPageSurfaceFocus({ row: 5, column: 8 }, 0, 1, layout)).toEqual({ row: 5, column: 0 })
		// Column 1 has keys but no knob. Down from the last key wraps back to the top key.
		expect(stepPageSurfaceFocus({ row: 3, column: 1 }, 1, 0, layout)).toEqual({ row: 0, column: 1 })
	})

	test('a library image is an image variable, an upload is not', () => {
		expect(pageImageVariableId('$(image:ptz-6)')).toBe('image:ptz-6')
		expect(pageImageVariableId('data:image/png;base64,abc')).toBeNull()
		expect(pageImageVariableId(null)).toBeNull()
		expect(pageImageVariableId('$(image:has space)')).toBeNull()
	})
})
