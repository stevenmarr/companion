import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import {
	ControlCenterPagesController,
	deckPin,
	wireDeckNav,
	type CcFetch,
	type CcPagesImportExport,
	type CcPagesInstances,
	type CcPagesPages,
} from '../../lib/Page/ControlCenterPagesController.js'

// PV fork, Control Center pages round 2: pictures in the list, "Place every page" with HOME / page keys turned into
// Companion page jumps, "My own look", and a list that scrolls.

const v = (value: unknown) => ({ isExpression: false, value })

/** A control the way Control Center's export looks after Companion upgrades it */
function key(pin: string, go?: string) {
	const press = {
		type: 'action',
		id: 'a1',
		definitionId: 'cc_deck_key',
		connectionId: 'ccPvControlCenter',
		options: { surface: v('plusxl'), pin: v(pin), event: v('press'), ...(go ? { go: v(go) } : {}) },
	}
	const release = { ...press, id: 'a2', options: { ...press.options, event: v('release') } }
	return {
		type: 'button-layered',
		steps: { 0: { action_sets: { down: [press], up: [release] }, options: { runWhileHeld: [] } } },
		feedbacks: [{ type: 'feedback', definitionId: 'cc_deck_look' }],
	}
}

function deckPage(pin: string, gos: Record<string, string>): ExportPageContentv6 {
	const row: Record<number, any> = {}
	for (const [col, go] of Object.entries(gos)) row[Number(col)] = key(pin, go || undefined)
	row[8] = key(pin)
	return {
		name: `CC ${pin}`,
		controls: { 0: row },
		gridSize: { minColumn: 0, maxColumn: 8, minRow: 0, maxRow: 5 },
	}
}

function memoryTable() {
	const rows = new Map<string, any>()
	return {
		all: () => Object.fromEntries(rows),
		get: (id: string) => rows.get(id),
		set: (id: string, value: any) => void rows.set(id, value),
		delete: (id: string) => void rows.delete(id),
	}
}

function setup(responses: Record<string, { status?: number; body: unknown; bytes?: Buffer }>) {
	const origins = memoryTable()
	const calls: string[] = []
	const fetchImpl: CcFetch = vi.fn(async (url, init) => {
		calls.push(url)
		const path = url.replace(/^http:\/\/[^/]+/, '')
		const bare = path.split('?')[0]
		const r = responses[`${init?.method ?? 'GET'} ${path}`] ??
			responses[`${init?.method ?? 'GET'} ${bare}`] ?? { status: 404, body: { error: 'Not found' } }
		return {
			ok: (r.status ?? 200) < 400,
			status: r.status ?? 200,
			json: async () => r.body,
			arrayBuffer: async () => {
				const b = r.bytes ?? Buffer.from(JSON.stringify(r.body))
				return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
			},
		}
	})
	let pageCount = 3
	const pageIds: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c' }
	const pages: CcPagesPages = {
		store: {
			getPageCount: () => pageCount,
			getPageId: (n) => pageIds[n],
			getPageNumber: (id) => Number(Object.keys(pageIds).find((k) => pageIds[Number(k)] === id)) || null,
		},
		insertPages: vi.fn((n: number, names: string[]) =>
			names.map((_, i) => {
				pageCount++
				pageIds[n + i] = `new-${n + i}`
				return `new-${n + i}`
			})
		),
		deletePage: vi.fn(() => []),
	}
	const instances: CcPagesInstances = {
		getAllConnectionIds: () => ['conn-cc'],
		getInstanceConfigOfType: () => ({
			moduleId: 'pvllc-control-center',
			label: 'cc',
			config: { host: '127.0.0.1', port: 8080 },
			enabled: true,
		}),
	}
	const importExport: CcPagesImportExport = {
		fileVersion: 12,
		capturePageForClass: vi.fn(() => null),
		upgradePageImport: vi.fn((raw: any) =>
			raw?.type === 'page' ? { page: structuredClone(raw.page), instances: raw.instances } : null
		),
		importPageForClass: vi.fn(async () => undefined),
	}
	const ctrl = new ControlCenterPagesController(origins, instances, pages, importExport, fetchImpl)
	return { ctrl, calls, pages, importExport, origins, fetchImpl }
}

const exportOf = (page: ExportPageContentv6) => ({
	body: {
		export: {
			version: 6,
			type: 'page',
			page,
			instances: { ccPvControlCenter: { label: 'cc', moduleId: 'pvllc-control-center' } },
		},
	},
})
const downOf = (page: ExportPageContentv6, col: number) => (page.controls as any)[0][col].steps[0].action_sets

describe('wireDeckNav', () => {
	it('turns keys whose page is placed into Companion page jumps on this deck, and leaves the rest', () => {
		const page = deckPage('ptz.0', { 0: 'home.0', 1: 'ptz.4', 2: 'atem.0' })
		const n = wireDeckNav(page, (pin) => ({ 'home.0': 'pg-home', 'ptz.4': 'pg-p4' })[pin])
		expect(n).toBe(2)
		expect(downOf(page, 0).down).toEqual([
			expect.objectContaining({
				definitionId: 'set_page',
				connectionId: 'internal',
				options: { surfaceId: v('self'), page: v('pg-home') },
			}),
		])
		expect(downOf(page, 0).up).toEqual([])
		expect(downOf(page, 1).down[0].options.page).toEqual(v('pg-p4'))
		expect(downOf(page, 2).down[0].definitionId).toBe('cc_deck_key')
		expect(downOf(page, 8).down[0].definitionId).toBe('cc_deck_key')
		// the key keeps Control Center's picture
		expect((page.controls as any)[0][0].feedbacks[0].definitionId).toBe('cc_deck_look')
	})

	it('deckPin reads deck page ids', () => {
		expect(deckPin('deck:plusxl:ptz.3')).toEqual({ surface: 'plusxl', pin: 'ptz.3' })
		expect(deckPin('deck:plusxl:')).toEqual({ surface: 'plusxl', pin: '' })
		expect(deckPin('library:x')).toBeNull()
	})
})

describe('Place every page', () => {
	const catalog = {
		deck: [
			{
				surface: 'plusxl',
				label: 'Stream Deck + XL',
				layout: 'streamdeck-plus-xl',
				pages: [
					{ id: 'deck:plusxl:', title: 'Whole deck (follows HOME and page keys)', whole: true },
					{ id: 'deck:plusxl:home.0', title: 'HOME' },
					{ id: 'deck:plusxl:ptz.0', title: 'PTZ paint · MSU' },
					{ id: 'deck:plusxl:ptz.1', title: 'PTZ presets' },
				],
			},
		],
		library: [],
		user: [],
	}
	const responses = {
		'GET /api/companion/catalog': { body: catalog },
		'GET /api/companion/catalog/export?id=deck%3Aplusxl%3Ahome.0&label=cc': exportOf(
			deckPage('home.0', { 1: 'ptz.0' })
		),
		'GET /api/companion/catalog/export?id=deck%3Aplusxl%3Aptz.0&label=cc': exportOf(
			deckPage('ptz.0', { 0: 'home.0', 3: 'ptz.1' })
		),
		'GET /api/companion/catalog/export?id=deck%3Aplusxl%3Aptz.1&label=cc': exportOf(deckPage('ptz.1', { 0: 'home.0' })),
	}

	it('places HOME and every system page in a row (not the whole deck) and wires their page keys', async () => {
		const { ctrl, pages, importExport, origins } = setup(responses)
		const res = await ctrl.placeDeck('plusxl')
		expect(res).toEqual({ firstPage: 4, count: 3, wired: 4 })
		expect(pages.insertPages).toHaveBeenCalledWith(4, ['HOME', 'PTZ paint · MSU', 'PTZ presets'])
		const imported = vi.mocked(importExport.importPageForClass).mock.calls
		expect(imported.map((c) => c[3])).toEqual([4, 5, 6])
		const ptz = imported[1][2]
		expect(downOf(ptz, 0).down[0].options.page).toEqual(v('new-4'))
		expect(downOf(ptz, 3).down[0].options.page).toEqual(v('new-6'))
		expect(origins.get('new-5')).toMatchObject({ catalogId: 'deck:plusxl:ptz.0' })
	})

	it('asks for pages without the deck look when "My own look" is on', async () => {
		const { ctrl, calls } = setup(
			Object.fromEntries(Object.entries(responses).map(([k, r]) => [k.replace('&label=cc', '&label=cc&look=0'), r]))
		)
		await ctrl.placeDeck('plusxl', false)
		expect(calls.filter((u) => u.includes('/export?')).every((u) => u.endsWith('&look=0'))).toBe(true)
	})

	it('makes no page when a page cannot be fetched', async () => {
		const { ctrl, pages } = setup({ 'GET /api/companion/catalog': { body: catalog } })
		await expect(ctrl.placeDeck('plusxl')).rejects.toThrow()
		expect(pages.insertPages).not.toHaveBeenCalled()
		await expect(setup(responses).ctrl.placeDeck('mk2')).rejects.toThrow(/no mk2 deck pages/)
	})

	it('a single page placed later jumps to the pages of that deck already placed', async () => {
		const { ctrl, importExport, origins } = setup(responses)
		origins.set('b', { pageId: 'b', catalogId: 'deck:plusxl:home.0', title: 'HOME' })
		await ctrl.place('deck:plusxl:ptz.0', '')
		const page = vi.mocked(importExport.importPageForClass).mock.calls[0][2]
		expect(downOf(page, 0).down[0].options.page).toEqual(v('b'))
		expect(downOf(page, 3).down[0].definitionId).toBe('cc_deck_key')
	})
})

describe('pictures', () => {
	const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])

	it('fetches a page picture on the server and hands the browser a data URL (cached briefly)', async () => {
		const { ctrl, fetchImpl, calls } = setup({
			'GET /api/companion/catalog/preview.png': { body: null, bytes: png },
		})
		const url = await ctrl.preview('deck:plusxl:ptz.0')
		expect(url).toBe(`data:image/png;base64,${png.toString('base64')}`)
		expect(calls[0]).toBe('http://127.0.0.1:8080/api/companion/catalog/preview.png?id=deck%3Aplusxl%3Aptz.0')
		await ctrl.preview('deck:plusxl:ptz.0')
		expect(fetchImpl).toHaveBeenCalledTimes(1)
	})

	it('no picture from an older Control Center, or anything that is not a PNG', async () => {
		expect(await setup({}).ctrl.preview('deck:plusxl:ptz.0')).toBeNull()
		const { ctrl } = setup({ 'GET /api/companion/catalog/preview.png': { body: { error: 'x' } } })
		expect(await ctrl.preview('library:x')).toBeNull()
	})
})

describe('Control Center pages screen, round 2', () => {
	const root = join(import.meta.dirname, '..', '..', '..')
	const read = (p: string) => readFileSync(join(root, p), 'utf8')

	it('scrolls: the screen fills the content area and scrolls itself', () => {
		const css = read('webui/src/Buttons/Pages.css')
		const block = css.slice(css.indexOf('.cc-pages-screen {'), css.indexOf('}', css.indexOf('.cc-pages-screen {')))
		expect(block).toContain('height: 100%')
		expect(block).toContain('overflow-y: auto')
		expect(block).toContain('min-height: 0')
	})

	it('shows a picture per page, Place every page, and My own look', () => {
		const ui = read('webui/src/Buttons/ControlCenterPages.tsx')
		expect(ui).toContain('controlCenterPages.preview')
		expect(ui).toContain('<img')
		expect(ui).toContain('Place every page')
		expect(ui).toContain('My own look')
		expect(ui).toContain('look: !ownLook')
	})
})
