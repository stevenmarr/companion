import { describe, expect, it, vi } from 'vitest'
import type { ExportInstancesv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { applyHostOverride, suggestNextLabel } from '@companion-app/shared/PageClass.js'
import {
	PageClassController,
	type PageClassImportExport,
	type PageClassInstances,
	type PageClassPages,
} from '../../lib/Page/PageClassController.js'
import { readCapturedConnections } from '../../lib/Page/PageClassLogic.js'

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

function pageCapture(label = 'PTZ-1'): { page: ExportPageContentv6; instances: ExportInstancesv6 } {
	return {
		page: {
			id: 'page-ptz',
			name: 'PTZ 1',
			controls: { 0: { 0: { type: 'button-layered', localVariables: [] } } },
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		},
		instances: {
			'cam-1': {
				label,
				moduleId: 'panasonic-ptz',
				moduleVersionId: '1.0.0',
				lastUpgradeIndex: 4,
				isFirstInit: false,
				enabled: true,
				config: { host: '192.168.0.11', port: 80 },
				secrets: { password: 'secret' },
			},
		},
	}
}

function createController(capture: ReturnType<typeof pageCapture> | null = pageCapture()) {
	const table = memoryTable()
	const pages: PageClassPages = {
		store: { getPageCount: () => 4 },
		insertPages: vi.fn(() => ['new-page']),
		deletePage: vi.fn(() => []),
	}
	const created: { id: string; label: string; config: unknown; secrets: unknown }[] = []
	const instances: PageClassInstances = {
		getIdForLabel: (type, label) => (type === ModuleInstanceType.Connection && label === 'PTZ-1' ? 'cam-1' : undefined),
		getInstanceConfigOfType: (id) =>
			id === 'cam-1' ? { moduleId: 'panasonic-ptz' } : id === 'other' ? { moduleId: 'roland-v60' } : undefined,
		addConnectionWithLabel: (_data, label) => {
			created.push({ id: `new-${label}`, label, config: null, secrets: null })
			return [`new-${label}`, { label }]
		},
		setConnectionLabelAndConfig: (id, values) => {
			const row = created.find((entry) => entry.id === id)
			if (row) {
				row.config = values.config
				row.secrets = values.secrets
			}
			return { ok: true }
		},
	}
	const imported: unknown[] = []
	const importExport: PageClassImportExport = {
		capturePageForClass: () => capture,
		importPageForClass: async (...args) => {
			imported.push(args)
		},
	}

	return {
		controller: new PageClassController(table, pages, instances, importExport),
		pages,
		created,
		imported,
		importExport,
	}
}

describe('page class helpers', () => {
	it('writes the address into the host field the module already has', () => {
		expect(applyHostOverride({ host: '192.168.0.11', port: 80 }, '192.168.0.12')).toEqual({
			config: { host: '192.168.0.12', port: 80 },
			applied: true,
		})
		expect(applyHostOverride({ cameraAddress: '10.0.0.1' }, '10.0.0.2')).toEqual({
			config: { cameraAddress: '10.0.0.2' },
			applied: true,
		})
		expect(applyHostOverride({ host: '10.0.0.1' }, '  ')).toEqual({
			config: { host: '10.0.0.1' },
			applied: true,
		})
		expect(applyHostOverride({ port: 80 }, '10.0.0.2').applied).toBe(false)
	})

	it('suggests the next numbered connection label', () => {
		expect(suggestNextLabel('PTZ-1', new Set(['PTZ-1']))).toBe('PTZ-2')
		expect(suggestNextLabel('PTZ-1', new Set(['PTZ-2', 'PTZ-3']))).toBe('PTZ-4')
		expect(suggestNextLabel('Cam', new Set())).toBe('Cam-2')
	})

	it('reads the connections stored with a class', () => {
		expect(readCapturedConnections(pageCapture().instances).map((connection) => connection.label)).toEqual(['PTZ-1'])
	})
})

describe('PageClassController', () => {
	it('saves a page and lists the connections on it, not the button snapshot', () => {
		const { controller } = createController()

		const saved = controller.saveFromPage(2, 'PTZ class')

		expect(saved.name).toBe('PTZ class')
		expect(saved.sourcePageName).toBe('PTZ 1')
		expect(saved.slots).toEqual([{ connectionId: 'cam-1', label: 'PTZ-1', moduleId: 'panasonic-ptz' }])
		expect(controller.list()).toEqual([saved])
	})

	it('creates a new connection with the new address and imports the page onto it', async () => {
		const { controller, created, imported, pages } = createController()
		const saved = controller.saveFromPage(2, 'PTZ class')

		const result = await controller.instantiate(saved.id, 'PTZ 2', [
			{ connectionId: 'cam-1', mode: 'clone', label: 'PTZ-2', host: '192.168.0.12' },
		])

		expect(result).toEqual({ pageNumber: 5 })
		expect(created).toEqual([
			{
				id: 'new-PTZ-2',
				label: 'PTZ-2',
				config: { host: '192.168.0.12', port: 80 },
				secrets: { password: 'secret' },
			},
		])
		expect(pages.insertPages).toHaveBeenCalledWith(5, ['PTZ 2'])
		expect(imported).toHaveLength(1)
		const [, remap, page, pageNumber] = imported[0] as [unknown, Record<string, string>, ExportPageContentv6, number]
		expect(remap).toEqual({ 'cam-1': 'new-PTZ-2' })
		expect(page.name).toBe('PTZ 2')
		expect(pageNumber).toBe(5)
	})

	it('points the new page at a connection that already exists', async () => {
		const { controller, created, imported } = createController()
		const saved = controller.saveFromPage(2, 'PTZ class')

		await controller.instantiate(saved.id, '', [
			{ connectionId: 'cam-1', mode: 'existing', existingConnectionId: 'cam-1' },
		])

		expect(created).toEqual([])
		const [, remap, page] = imported[0] as [unknown, Record<string, string>, ExportPageContentv6]
		expect(remap).toEqual({ 'cam-1': 'cam-1' })
		expect(page.name).toBe('PTZ class')
	})

	it('refuses a connection of the wrong module and a label that is already used', async () => {
		const { controller, created } = createController()
		const saved = controller.saveFromPage(2, 'PTZ class')

		await expect(
			controller.instantiate(saved.id, 'PTZ 2', [
				{ connectionId: 'cam-1', mode: 'existing', existingConnectionId: 'other' },
			])
		).rejects.toThrow(/panasonic-ptz/)

		await expect(
			controller.instantiate(saved.id, 'PTZ 2', [{ connectionId: 'cam-1', mode: 'clone', label: 'PTZ-1' }])
		).rejects.toThrow(/already in use/)

		expect(created).toEqual([])
	})

	it('removes the new page if the import fails', async () => {
		const { controller, pages, importExport } = createController()
		importExport.importPageForClass = async () => {
			throw new Error('import failed')
		}
		const saved = controller.saveFromPage(2, 'PTZ class')

		await expect(
			controller.instantiate(saved.id, 'PTZ 2', [
				{ connectionId: 'cam-1', mode: 'clone', label: 'PTZ-2', host: '192.168.0.12' },
			])
		).rejects.toThrow('import failed')
		expect(pages.deletePage).toHaveBeenCalledWith(5)
	})
})
