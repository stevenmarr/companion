import z from 'zod'
import type {
	ControlCenterPagesCatalog,
	ControlCenterPagesState,
	ControlCenterUserPage,
} from '@companion-app/shared/Model/ControlCenterPages.js'
import type { ExportInstancesv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'

/**
 * PV fork: "Control Center pages". Pages output by Control Center (the live PTZ / ATEM / HOME / CONSOLE deck pages,
 * the PAGES library pages, and user pages saved back from here) can be placed as a new Companion page. That page is
 * its own copy: edit it like any page, the Control Center original never changes. An edited copy can be saved into
 * Control Center's USER PAGES (stored in Control Center, so it is backed up with the app and listed there too).
 *
 * Control Center is found through the first Performance Video Control Center connection (its host and port), so
 * there is nothing extra to set up. It talks to Control Center 0.33.0+ over HTTP:
 * GET /api/companion/catalog, GET /api/companion/catalog/export?id=, POST/DELETE /api/companion/user-pages[/:id].
 */

export const CC_MODULE_IDS = ['pvllc-control-center', 'rs6-presets']
const FETCH_TIMEOUT_MS = 8000

/** Where a placed page came from (keyed by Companion page id), so "Save to User pages" can say and update it */
export interface ControlCenterPageOrigin {
	pageId: string
	catalogId: string
	title: string
	userPageId?: string
}

type OriginTable = Pick<DataStoreTableView<Record<string, ControlCenterPageOrigin>>, 'all' | 'get' | 'set' | 'delete'>

export interface CcPagesInstances {
	getAllConnectionIds(): string[]
	getInstanceConfigOfType(
		id: string,
		type: ModuleInstanceType | null
	): { moduleId: string; label: string; config: unknown; enabled: boolean } | undefined
}

export interface CcPagesPages {
	readonly store: {
		getPageCount(): number
		getPageId(pageNumber: number): string | undefined
		getPageNumber(pageId: string): number | null
	}
	insertPages(asPageNumber: number, pageNames: string[]): string[]
	deletePage(pageNumber: number): string[]
}

export interface CcPagesImportExport {
	capturePageForClass(pageNumber: number): { page: ExportPageContentv6; instances: ExportInstancesv6 } | null
	upgradePageImport(raw: unknown): { page: ExportPageContentv6; instances: ExportInstancesv6 } | null
	importPageForClass(
		instances: ExportInstancesv6 | undefined,
		connectionIdRemapping: Record<string, string | undefined>,
		pageInfo: ExportPageContentv6,
		topage: number
	): Promise<unknown>
	readonly fileVersion: number
}

export type CcFetch = (
	url: string,
	init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{
	ok: boolean
	status: number
	json(): Promise<unknown>
}>

function errorOf(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

/** Keep only what a page needs to find its connections again: never a connection's config or secrets */
export function minimalInstances(
	instances: ExportInstancesv6 | undefined
): Record<string, { label: string; moduleId: string; lastUpgradeIndex: number }> {
	const out: Record<string, { label: string; moduleId: string; lastUpgradeIndex: number }> = {}
	for (const [id, raw] of Object.entries(instances ?? {})) {
		const c = raw as Record<string, unknown> | undefined
		if (!c) continue
		const moduleRaw = c.moduleId ?? c.instance_type
		const moduleId = typeof moduleRaw === 'string' ? moduleRaw : ''
		if (!moduleId) continue
		const labelRaw = c.label
		out[id] = {
			label: typeof labelRaw === 'string' ? labelRaw : id,
			moduleId,
			lastUpgradeIndex: typeof c.lastUpgradeIndex === 'number' ? c.lastUpgradeIndex : -1,
		}
	}
	return out
}

export class ControlCenterPagesController {
	readonly #logger = LogController.createLogger('Page/ControlCenterPages')

	readonly #origins: OriginTable
	readonly #instances: CcPagesInstances
	readonly #pages: CcPagesPages
	readonly #importExport: CcPagesImportExport
	readonly #fetch: CcFetch

	constructor(
		origins: OriginTable,
		instances: CcPagesInstances,
		pages: CcPagesPages,
		importExport: CcPagesImportExport,
		fetchImpl?: CcFetch
	) {
		this.#origins = origins
		this.#instances = instances
		this.#pages = pages
		this.#importExport = importExport
		this.#fetch = fetchImpl ?? globalThis.fetch
	}

	createTrpcRouter() {
		return router({
			state: publicProcedure.query(async () => this.state()),

			place: publicProcedure
				.input(
					z.object({
						id: z.string().min(1).max(200),
						pageName: z.string().max(60).optional(),
						/** Replace this page (its buttons go) instead of adding a new page at the end */
						targetPage: z.number().int().min(1).optional(),
					})
				)
				.mutation(async ({ input }) => this.place(input.id, input.pageName ?? '', input.targetPage)),

			saveUserPage: publicProcedure
				.input(
					z.object({
						pageNumber: z.number().int().min(1),
						name: z.string().max(60),
						userPageId: z.string().max(40).optional(),
					})
				)
				.mutation(async ({ input }) => this.saveUserPage(input.pageNumber, input.name, input.userPageId)),

			removeUserPage: publicProcedure
				.input(z.object({ userPageId: z.string().min(1).max(40) }))
				.mutation(async ({ input }) => this.removeUserPage(input.userPageId)),

			originOf: publicProcedure
				.input(z.object({ pageNumber: z.number().int().min(1) }))
				.query(({ input }) => this.originOf(input.pageNumber)),
		})
	}

	/** The Control Center connection (first enabled one, else the first) and the app's address */
	connection(): { id: string; label: string; baseUrl: string } | null {
		let first: { id: string; label: string; baseUrl: string; enabled: boolean } | null = null
		for (const id of this.#instances.getAllConnectionIds()) {
			const c = this.#instances.getInstanceConfigOfType(id, ModuleInstanceType.Connection)
			if (!c || !CC_MODULE_IDS.includes(c.moduleId)) continue
			const cfg = (c.config ?? {}) as { host?: unknown; port?: unknown }
			const host =
				typeof cfg.host === 'string' && /^[\w.-]{1,253}$|^\[[0-9A-Fa-f:.]+\]$/.test(cfg.host.trim())
					? cfg.host.trim()
					: '127.0.0.1'
			const port = Number(cfg.port) > 0 && Number(cfg.port) < 65536 ? Number(cfg.port) : 8080
			const entry = { id, label: c.label, baseUrl: `http://${host}:${port}`, enabled: c.enabled }
			if (c.enabled) return entry
			first ??= entry
		}
		return first
	}

	async #call(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
		const conn = this.connection()
		if (!conn) throw new Error('Add a Performance Video Control Center connection first (Connections → Add)')
		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
		try {
			const res = await this.#fetch(conn.baseUrl + path, {
				method: init?.method ?? 'GET',
				headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
				body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
				signal: ctrl.signal,
			})
			const json = (await res.json().catch(() => null)) as { error?: string } | null
			if (res.status === 404 && path.startsWith('/api/companion/catalog') && !json?.error?.startsWith('No ')) {
				throw new Error('Control Center pages need Control Center 0.33.0 or newer')
			}
			if (!res.ok) throw new Error(json?.error || `Control Center answered HTTP ${res.status}`)
			return json
		} catch (e) {
			if (ctrl.signal.aborted) throw new Error(`Control Center did not answer at ${conn.baseUrl}`)
			throw e
		} finally {
			clearTimeout(timer)
		}
	}

	async state(): Promise<ControlCenterPagesState> {
		const conn = this.connection()
		if (!conn)
			return { connection: null, catalog: null, error: 'Add a Performance Video Control Center connection first' }
		try {
			const catalog = (await this.#call('/api/companion/catalog')) as ControlCenterPagesCatalog
			return { connection: { id: conn.id, label: conn.label, url: conn.baseUrl }, catalog, error: null }
		} catch (e) {
			return { connection: { id: conn.id, label: conn.label, url: conn.baseUrl }, catalog: null, error: errorOf(e) }
		}
	}

	/** Map each connection a Control Center page refers to onto a connection here */
	#remap(instances: ExportInstancesv6, ccConnectionId: string): Record<string, string | undefined> {
		const remap: Record<string, string | undefined> = {}
		const missing: string[] = []
		const all = this.#instances
			.getAllConnectionIds()
			.map((id) => ({ id, c: this.#instances.getInstanceConfigOfType(id, ModuleInstanceType.Connection) }))
		for (const [ref, info] of Object.entries(minimalInstances(instances))) {
			if (CC_MODULE_IDS.includes(info.moduleId)) {
				remap[ref] = ccConnectionId
				continue
			}
			const same = all.filter((x) => x.c?.moduleId === info.moduleId)
			const hit = same.find((x) => x.c?.label === info.label) ?? same[0]
			if (hit) remap[ref] = hit.id
			else missing.push(`${info.label} (${info.moduleId})`)
		}
		if (missing.length) throw new Error(`This page also uses ${missing.join(', ')}. Add that connection first.`)
		return remap
	}

	/**
	 * Place a Control Center page as a copy: a new page at the end, or (targetPage) on an existing page, replacing what
	 * is there. Either way the layout is Control Center's, key for key, strip and knobs included.
	 */
	async place(
		catalogId: string,
		pageNameInput: string,
		targetPage?: number
	): Promise<{ pageNumber: number; name: string; replaced: boolean }> {
		const conn = this.connection()
		if (!conn) throw new Error('Add a Performance Video Control Center connection first (Connections → Add)')
		const res = (await this.#call(
			`/api/companion/catalog/export?id=${encodeURIComponent(catalogId)}&label=${encodeURIComponent(conn.label)}`
		)) as { name?: string; export?: unknown }
		const upgraded = this.#importExport.upgradePageImport(res?.export)
		if (!upgraded) throw new Error('Control Center sent something that is not a page')
		const remap = this.#remap(upgraded.instances, conn.id)

		const pageName = pageNameInput.trim() || upgraded.page.name?.trim() || 'Control Center page'
		const page = structuredClone(upgraded.page)
		page.name = pageName
		const userPageId = catalogId.startsWith('user:') ? catalogId.slice(5) : undefined

		if (targetPage !== undefined) {
			const targetId = this.#pages.store.getPageId(targetPage)
			if (!targetId) throw new Error(`There is no page ${targetPage}`)
			// importSinglePage clears the page first, then lays out the Control Center page and names it
			await this.#importExport.importPageForClass(upgraded.instances, remap, page, targetPage)
			this.#origins.set(targetId, {
				pageId: targetId,
				catalogId,
				title: pageName,
				...(userPageId ? { userPageId } : {}),
			})
			this.#logger.info(`Placed Control Center page ${catalogId} on page ${targetPage} (${pageName}), a copy`)
			return { pageNumber: targetPage, name: pageName, replaced: true }
		}

		const pageNumber = this.#pages.store.getPageCount() + 1
		const ids = this.#pages.insertPages(pageNumber, [pageName])
		if (ids.length === 0) throw new Error('Failed to create a page')
		try {
			await this.#importExport.importPageForClass(upgraded.instances, remap, page, pageNumber)
		} catch (e) {
			try {
				this.#pages.deletePage(pageNumber)
			} catch {
				// The failed page is empty. Leave it if it cannot be removed.
			}
			throw e
		}
		this.#origins.set(ids[0], { pageId: ids[0], catalogId, title: pageName, ...(userPageId ? { userPageId } : {}) })
		this.#logger.info(`Placed Control Center page ${catalogId} as page ${pageNumber} (${pageName}), a copy`)
		return { pageNumber, name: pageName, replaced: false }
	}

	originOf(pageNumber: number): ControlCenterPageOrigin | null {
		const id = this.#pages.store.getPageId(pageNumber)
		return (id && this.#origins.get(id)) || null
	}

	async saveUserPage(pageNumber: number, nameInput: string, userPageId?: string): Promise<ControlCenterUserPage> {
		const captured = this.#importExport.capturePageForClass(pageNumber)
		if (!captured) throw new Error('Page not found')
		const origin = this.originOf(pageNumber)
		const name = nameInput.trim() || captured.page.name?.trim() || `Page ${pageNumber}`
		const body = {
			name,
			page: captured.page,
			instances: minimalInstances(captured.instances),
			version: this.#importExport.fileVersion,
			origin: origin?.catalogId ?? '',
			originTitle: origin?.title ?? '',
		}
		const path = userPageId
			? `/api/companion/user-pages/${encodeURIComponent(userPageId)}`
			: '/api/companion/user-pages'
		const saved = (await this.#call(path, { method: 'POST', body })) as ControlCenterUserPage
		const pageId = this.#pages.store.getPageId(pageNumber)
		if (pageId && saved?.id) {
			this.#origins.set(pageId, {
				pageId,
				catalogId: origin?.catalogId ?? `user:${saved.id}`,
				title: origin?.title ?? name,
				userPageId: saved.id,
			})
		}
		this.#logger.info(`Saved page ${pageNumber} to Control Center user page ${saved?.id}`)
		return saved
	}

	async removeUserPage(userPageId: string): Promise<void> {
		await this.#call(`/api/companion/user-pages/${encodeURIComponent(userPageId)}`, { method: 'DELETE' })
		for (const [key, o] of Object.entries(this.#origins.all())) {
			if (o?.userPageId === userPageId) this.#origins.set(key, { ...o, userPageId: undefined })
		}
	}
}
