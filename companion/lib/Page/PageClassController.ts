import { nanoid } from 'nanoid'
import z from 'zod'
import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ExportInstancesv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { PageClassSummary } from '@companion-app/shared/Model/PageClassModel.js'
import { applyHostOverride } from '@companion-app/shared/PageClass.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { AddInstanceProps } from '../Instance/ConfigStore.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import { readCapturedConnections, slotsFromCaptured, type CapturedConnection } from './PageClassLogic.js'

interface PageClassModel extends PageClassSummary {
	page: ExportPageContentv6
	instances: ExportInstancesv6
}

type PageClassTable = Pick<DataStoreTableView<Record<string, PageClassModel>>, 'all' | 'get' | 'set' | 'delete'>

export interface PageClassPages {
	readonly store: { getPageCount(): number }
	insertPages(asPageNumber: number, pageNames: string[]): string[]
	deletePage(pageNumber: number): string[]
}

export interface PageClassInstances {
	getIdForLabel(type: ModuleInstanceType, label: string): string | undefined
	getInstanceConfigOfType(id: string, type: ModuleInstanceType): { moduleId: string } | undefined
	addConnectionWithLabel(
		data: { type: string; product?: string },
		labelBase: string,
		props: AddInstanceProps
	): [id: string, config: { label: string }]
	setConnectionLabelAndConfig(
		id: string,
		values: {
			label: string | null
			enabled: boolean | null
			config: unknown | null
			secrets: unknown | null
			updatePolicy: InstanceVersionUpdatePolicy | null
			upgradeIndex: number | null
		}
	): { ok: true } | { ok: false; message: string }
}

export interface PageClassCapture {
	page: ExportPageContentv6
	instances: ExportInstancesv6
}

export interface PageClassImportExport {
	capturePageForClass(pageNumber: number): PageClassCapture | null
	importPageForClass(
		instances: ExportInstancesv6 | undefined,
		connectionIdRemapping: Record<string, string | undefined>,
		pageInfo: ExportPageContentv6,
		topage: number
	): Promise<unknown>
}

const slotBindingSchema = z.object({
	connectionId: z.string().min(1),
	mode: z.enum(['existing', 'clone']),
	existingConnectionId: z.string().optional(),
	label: z.string().optional(),
	host: z.string().optional(),
})

type SlotBinding = z.infer<typeof slotBindingSchema>

/**
 * A page class is a snapshot of one page. Creating an instance copies that page and points its
 * connections at different devices. Editing the class later does not change pages already created.
 */
export class PageClassController {
	readonly #logger = LogController.createLogger('Page/PageClass')

	readonly #table: PageClassTable
	readonly #pages: PageClassPages
	readonly #instances: PageClassInstances
	readonly #importExport: PageClassImportExport

	constructor(
		table: PageClassTable,
		pages: PageClassPages,
		instances: PageClassInstances,
		importExport: PageClassImportExport
	) {
		this.#table = table
		this.#pages = pages
		this.#instances = instances
		this.#importExport = importExport
	}

	createTrpcRouter() {
		return router({
			list: publicProcedure.query(() => this.list()),

			saveFromPage: publicProcedure
				.input(z.object({ pageNumber: z.number().int().min(1), name: z.string() }))
				.mutation(({ input }) => this.saveFromPage(input.pageNumber, input.name)),

			updateFromPage: publicProcedure
				.input(z.object({ classId: z.string().min(1), pageNumber: z.number().int().min(1) }))
				.mutation(({ input }) => this.updateFromPage(input.classId, input.pageNumber)),

			rename: publicProcedure
				.input(z.object({ classId: z.string().min(1), name: z.string() }))
				.mutation(({ input }) => {
					this.rename(input.classId, input.name)
				}),

			remove: publicProcedure.input(z.object({ classId: z.string().min(1) })).mutation(({ input }) => {
				this.remove(input.classId)
			}),

			instantiate: publicProcedure
				.input(
					z.object({
						classId: z.string().min(1),
						pageName: z.string(),
						bindings: z.array(slotBindingSchema),
					})
				)
				.mutation(async ({ input }) => this.instantiate(input.classId, input.pageName, input.bindings)),
		})
	}

	list(): PageClassSummary[] {
		return Object.values(this.#table.all())
			.filter((entry): entry is PageClassModel => !!entry?.id)
			.map((entry) => this.#summary(entry))
			.sort((a, b) => a.name.localeCompare(b.name) || b.updatedAt - a.updatedAt)
	}

	saveFromPage(pageNumber: number, name: string): PageClassSummary {
		const captured = this.#capture(pageNumber)
		const id = nanoid()
		const model: PageClassModel = {
			id,
			name: name.trim() || captured.sourcePageName,
			sourcePageName: captured.sourcePageName,
			updatedAt: Date.now(),
			slots: captured.slots,
			page: captured.page,
			instances: captured.instances,
		}
		this.#table.set(id, model)
		this.#logger.info(`Saved page ${pageNumber} as page class ${id}`)
		return this.#summary(model)
	}

	updateFromPage(classId: string, pageNumber: number): PageClassSummary {
		const existing = this.#require(classId)
		const captured = this.#capture(pageNumber)
		const model: PageClassModel = {
			...existing,
			sourcePageName: captured.sourcePageName,
			updatedAt: Date.now(),
			slots: captured.slots,
			page: captured.page,
			instances: captured.instances,
		}
		this.#table.set(classId, model)
		this.#logger.info(`Updated page class ${classId} from page ${pageNumber}`)
		return this.#summary(model)
	}

	rename(classId: string, name: string): void {
		const existing = this.#require(classId)
		const trimmed = name.trim()
		if (!trimmed || trimmed === existing.name) return
		this.#table.set(classId, { ...existing, name: trimmed, updatedAt: Date.now() })
	}

	remove(classId: string): void {
		if (!this.#table.get(classId)) throw new Error('Page class not found')
		this.#table.delete(classId)
		this.#logger.info(`Deleted page class ${classId}`)
	}

	async instantiate(classId: string, pageNameInput: string, bindings: SlotBinding[]): Promise<{ pageNumber: number }> {
		const stored = this.#require(classId)
		const captured = readCapturedConnections(stored.instances)
		const bindingById = new Map(bindings.map((binding) => [binding.connectionId, binding]))

		const clones: { captured: CapturedConnection; label: string; config: unknown }[] = []
		const remap: Record<string, string> = {}
		const newLabels = new Set<string>()

		for (const connection of captured) {
			const binding = bindingById.get(connection.connectionId)
			if (!binding) throw new Error(`Choose a connection for ${connection.label}`)

			if (binding.mode === 'existing') {
				const existingId = binding.existingConnectionId?.trim() ?? ''
				if (!existingId) throw new Error(`Choose a connection for ${connection.label}`)
				const existing = this.#instances.getInstanceConfigOfType(existingId, ModuleInstanceType.Connection)
				if (!existing) throw new Error(`Connection for ${connection.label} was not found`)
				if (existing.moduleId !== connection.moduleId) {
					throw new Error(`${connection.label} needs a ${connection.moduleId} connection`)
				}
				remap[connection.connectionId] = existingId
				continue
			}

			const label = binding.label?.trim() ?? ''
			if (!isLabelValid(label)) {
				throw new Error(
					`"${label || connection.label}" is not a valid connection label. Use letters, numbers, "_" and "-" only`
				)
			}
			if (newLabels.has(label) || this.#instances.getIdForLabel(ModuleInstanceType.Connection, label)) {
				throw new Error(`Connection label "${label}" is already in use`)
			}
			newLabels.add(label)

			const patched = applyHostOverride(connection.config, binding.host)
			if (!patched.applied) {
				throw new Error(
					`${connection.label} has no host or address field to fill in. Leave the address blank, or use a connection you already created`
				)
			}
			clones.push({ captured: connection, label, config: patched.config })
		}

		for (const clone of clones) {
			const [id] = this.#instances.addConnectionWithLabel({ type: clone.captured.moduleId }, clone.label, {
				versionId: clone.captured.moduleVersionId,
				updatePolicy: clone.captured.updatePolicy ?? InstanceVersionUpdatePolicy.Stable,
				disabled: true,
			})
			const configured = this.#instances.setConnectionLabelAndConfig(id, {
				label: null,
				enabled: clone.captured.enabled,
				config: clone.config,
				secrets: clone.captured.secrets ?? null,
				updatePolicy: null,
				upgradeIndex: clone.captured.lastUpgradeIndex,
			})
			if (!configured.ok) throw new Error(configured.message)
			remap[clone.captured.connectionId] = id
		}

		const pageName = pageNameInput.trim() || stored.name || stored.sourcePageName || 'Page'
		const pageNumber = this.#pages.store.getPageCount() + 1
		const pageIds = this.#pages.insertPages(pageNumber, [pageName])
		if (pageIds.length === 0) throw new Error('Failed to create a page')

		const page = structuredClone(stored.page)
		page.name = pageName

		try {
			await this.#importExport.importPageForClass(stored.instances, remap, page, pageNumber)
		} catch (e) {
			try {
				this.#pages.deletePage(pageNumber)
			} catch {
				// The failed page is empty. Leave it if it cannot be removed.
			}
			throw e
		}

		this.#logger.info(`Instantiated page class ${classId} as page ${pageNumber}`)
		return { pageNumber }
	}

	#capture(pageNumber: number): {
		sourcePageName: string
		slots: PageClassSummary['slots']
		page: ExportPageContentv6
		instances: ExportInstancesv6
	} {
		const captured = this.#importExport.capturePageForClass(pageNumber)
		if (!captured) throw new Error('Page not found')

		const connections = readCapturedConnections(captured.instances)
		return {
			sourcePageName: captured.page.name?.trim() || `Page ${pageNumber}`,
			slots: slotsFromCaptured(connections),
			page: captured.page,
			instances: captured.instances,
		}
	}

	#require(classId: string): PageClassModel {
		const found = this.#table.get(classId)
		if (!found) throw new Error('Page class not found')
		return found
	}

	#summary(model: PageClassModel): PageClassSummary {
		return {
			id: model.id,
			name: model.name,
			sourcePageName: model.sourcePageName,
			updatedAt: model.updatedAt,
			slots: model.slots,
		}
	}
}
