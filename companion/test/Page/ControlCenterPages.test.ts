import { describe, expect, it, vi } from 'vitest'
import type { ExportInstancesv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import {
	ControlCenterPagesController,
	minimalInstances,
	type CcFetch,
	type CcPagesImportExport,
	type CcPagesInstances,
	type CcPagesPages,
} from '../../lib/Page/ControlCenterPagesController.js'

function memoryTable() {
	const rows = new Map<string, any>()
	return {
		all: () => Object.fromEntries(rows),
		get: (id: string) => rows.get(id),
		set: (id: string, value: any) => {
			rows.set(id, value)
		},
		delete: (id: string) => {
			rows.delete(id)
		},
	}
}

const connections: Record<string, { moduleId: string; label: string; config: unknown; enabled: boolean }> = {
	'conn-cc': {
		moduleId: 'pvllc-control-center',
		label: 'rs6presets',
		config: { host: '10.0.0.5', port: 8080 },
		enabled: true,
	},
	'conn-atem': { moduleId: 'bmd-atem', label: 'atem', config: { host: '10.0.0.9' }, enabled: true },
}

function ccPage(name = 'CC PTZ'): { page: ExportPageContentv6; instances: ExportInstancesv6 } {
	return {
		page: { id: 'p', name, controls: {}, gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 } },
		instances: { ccmod: { label: 'rs6presets', moduleId: 'pvllc-control-center', lastUpgradeIndex: -1 } },
	}
}

function setup(responses: Record<string, { status?: number; body: unknown }>) {
	const origins = memoryTable()
	const calls: { url: string; method: string; body?: any }[] = []
	const fetchImpl: CcFetch = vi.fn(async (url, init) => {
		calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined })
		const path = url.replace(/^http:\/\/[^/]+/, '').split('?')[0]
		const r = responses[`${init?.method ?? 'GET'} ${path}`] ?? { status: 404, body: { error: 'Not found' } }
		return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body }
	})
	let pageCount = 3
	const pageIds: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c' }
	const pages: CcPagesPages = {
		store: {
			getPageCount: () => pageCount,
			getPageId: (n) => pageIds[n],
			getPageNumber: (id) => Number(Object.keys(pageIds).find((k) => pageIds[Number(k)] === id)) || null,
		},
		insertPages: vi.fn((n: number) => {
			pageCount++
			pageIds[n] = `new-${n}`
			return [`new-${n}`]
		}),
		deletePage: vi.fn(() => []),
	}
	const instances: CcPagesInstances = {
		getAllConnectionIds: () => Object.keys(connections),
		getInstanceConfigOfType: (id) => connections[id],
	}
	const importExport: CcPagesImportExport = {
		fileVersion: 12,
		capturePageForClass: vi.fn(() => ({
			page: { id: 'c', name: 'My PTZ', controls: { 0: { 0: { type: 'button-layered' } } } } as any,
			instances: {
				'conn-cc': {
					label: 'rs6presets',
					moduleId: 'pvllc-control-center',
					lastUpgradeIndex: 2,
					config: { host: 'x' },
					secrets: { token: 'nope' },
				} as any,
			},
		})),
		upgradePageImport: vi.fn((raw: any) =>
			raw?.type === 'page' ? { page: raw.page, instances: raw.instances } : null
		),
		importPageForClass: vi.fn(async () => undefined),
	}
	const ctrl = new ControlCenterPagesController(origins, instances, pages, importExport, fetchImpl)
	return { ctrl, calls, pages, importExport, origins }
}

describe('ControlCenterPagesController', () => {
	it('finds Control Center through the CC connection host and port', async () => {
		const { ctrl, calls } = setup({ 'GET /api/companion/catalog': { body: { deck: [], library: [], user: [] } } })
		expect(ctrl.connection()).toEqual({
			id: 'conn-cc',
			label: 'rs6presets',
			baseUrl: 'http://10.0.0.5:8080',
			enabled: true,
		})
		const state = await ctrl.state()
		expect(state.error).toBeNull()
		expect(calls[0].url).toBe('http://10.0.0.5:8080/api/companion/catalog')
	})

	it('says when Control Center is too old for pages', async () => {
		const { ctrl } = setup({})
		expect((await ctrl.state()).error).toMatch(/0\.33\.0/)
	})

	it('places a page as a new copy, pointed at the CC connection, and remembers where it came from', async () => {
		const { ctrl, calls, importExport, origins } = setup({
			'GET /api/companion/catalog/export': { body: { name: 'x', export: { version: 6, type: 'page', ...ccPage() } } },
		})
		const res = await ctrl.place('deck:plusxl:ptz.0', 'PTZ copy')
		expect(res).toEqual({ pageNumber: 4, name: 'PTZ copy' })
		expect(calls[0].url).toContain('id=deck%3Aplusxl%3Aptz.0&label=rs6presets')
		expect(importExport.importPageForClass).toHaveBeenCalledWith(
			expect.anything(),
			{ ccmod: 'conn-cc' },
			expect.objectContaining({ name: 'PTZ copy' }),
			4
		)
		expect(origins.get('new-4')).toMatchObject({ catalogId: 'deck:plusxl:ptz.0', title: 'PTZ copy' })
	})

	it('refuses a page that needs a connection that is not here, without leaving an empty page', async () => {
		const page = ccPage()
		;(page.instances as any).vmix = { label: 'vmix', moduleId: 'studiocoast-vmix' }
		const { ctrl, pages } = setup({
			'GET /api/companion/catalog/export': { body: { export: { version: 6, type: 'page', ...page } } },
		})
		await expect(ctrl.place('library:x', '')).rejects.toThrow(/vmix \(studiocoast-vmix\)/)
		expect(pages.insertPages).not.toHaveBeenCalled()
	})

	it('removes the new page again when the import fails', async () => {
		const { ctrl, pages, importExport } = setup({
			'GET /api/companion/catalog/export': { body: { export: { version: 6, type: 'page', ...ccPage() } } },
		})
		vi.mocked(importExport.importPageForClass).mockRejectedValueOnce(new Error('boom'))
		await expect(ctrl.place('library:x', '')).rejects.toThrow('boom')
		expect(pages.deletePage).toHaveBeenCalledWith(4)
	})

	it('saves an edited page to User pages without connection config or secrets, then updates the same user page', async () => {
		const saved = { id: 'u123', name: 'My PTZ' }
		const { ctrl, calls } = setup({
			'POST /api/companion/user-pages': { body: saved },
			'POST /api/companion/user-pages/u123': { body: saved },
		})
		await ctrl.saveUserPage(3, 'My PTZ')
		expect(calls[0].body.version).toBe(12)
		expect(calls[0].body.instances).toEqual({
			'conn-cc': { label: 'rs6presets', moduleId: 'pvllc-control-center', lastUpgradeIndex: 2 },
		})
		expect(JSON.stringify(calls[0].body)).not.toContain('nope')
		expect(ctrl.originOf(3)).toMatchObject({ userPageId: 'u123' })
		await ctrl.saveUserPage(3, 'My PTZ', 'u123')
		expect(calls[1].url).toMatch(/\/api\/companion\/user-pages\/u123$/)
	})

	it('minimalInstances drops everything but label, module and upgrade index', () => {
		expect(minimalInstances({ a: { label: 'L', moduleId: 'm', config: { pw: 1 } } as any, b: undefined })).toEqual({
			a: { label: 'L', moduleId: 'm', lastUpgradeIndex: -1 },
		})
	})
})
