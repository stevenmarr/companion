import { nanoid } from 'nanoid'
import z from 'zod'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ModuleInstanceType, type InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import {
	fixupButtonReferenceControl,
	fixupLayeredButtonControl,
	fixupPresetReferenceControl,
	type InstanceAppliedRemappings,
} from '../ImportExport/ImportFixup.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import LogController from '../Log/Controller.js'
import { zodLocation } from '../Preview/Graphics.js'
import { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import {
	describeButtonFavorite,
	isFavoriteButton,
	type ButtonFavoriteSummary,
	type FavoriteConnectionSlot,
	type FavoritePageSlot,
	type FavoriteSurfaceSlot,
} from './ButtonFavoriteLogic.js'
import type { ControlsController } from './Controller.js'

interface ButtonFavoriteModel extends ButtonFavoriteSummary {
	control: SomeButtonModel
	createdAt: number
}

type ButtonFavoriteTable = Pick<
	DataStoreTableView<Record<string, ButtonFavoriteModel>>,
	'all' | 'get' | 'set' | 'delete'
>

export interface ButtonFavoritePages {
	getControlIdAt(location: ControlLocation): string | null
	isPageValid(pageNumber: number): boolean
	isPageIdValid(pageId: string): boolean
}

const idRemapSchema = z.object({
	fromId: z.string().min(1),
	toId: z.string().min(1),
})

/**
 * A favorite is a snapshot of one button. Dropping it onto the grid copies that button and,
 * when it names a connection, a page, or a surface, points those at what the user picks.
 * It does not stay linked to the button it was saved from.
 */
export class ButtonFavoriteController {
	readonly #logger = LogController.createLogger('Controls/ButtonFavorite')

	readonly #table: ButtonFavoriteTable
	readonly #pages: ButtonFavoritePages
	readonly #controls: ControlsController
	readonly #instances: InstanceController
	readonly #internalModule: InternalController
	readonly #graphics: GraphicsController

	constructor(
		table: ButtonFavoriteTable,
		pages: ButtonFavoritePages,
		controls: ControlsController,
		instances: InstanceController,
		internalModule: InternalController,
		graphics: GraphicsController
	) {
		this.#table = table
		this.#pages = pages
		this.#controls = controls
		this.#instances = instances
		this.#internalModule = internalModule
		this.#graphics = graphics
	}

	createTrpcRouter() {
		return router({
			list: publicProcedure.query(() => this.list()),

			saveFromLocation: publicProcedure
				.input(z.object({ location: zodLocation, name: z.string() }))
				.mutation(async ({ input }) => this.saveFromLocation(input.location, input.name)),

			rename: publicProcedure
				.input(z.object({ favoriteId: z.string().min(1), name: z.string() }))
				.mutation(({ input }) => {
					this.rename(input.favoriteId, input.name)
				}),

			remove: publicProcedure.input(z.object({ favoriteId: z.string().min(1) })).mutation(({ input }) => {
				this.remove(input.favoriteId)
			}),

			place: publicProcedure
				.input(
					z.object({
						favoriteId: z.string().min(1),
						location: zodLocation,
						connections: z.array(idRemapSchema),
						pages: z.array(idRemapSchema),
						surfaces: z.array(idRemapSchema),
					})
				)
				.mutation(async ({ input }) =>
					this.place(input.favoriteId, input.location, input.connections, input.pages, input.surfaces)
				),
		})
	}

	list(): ButtonFavoriteSummary[] {
		return Object.values(this.#table.all())
			.filter((entry): entry is ButtonFavoriteModel => !!entry?.id && isFavoriteButton(entry.control))
			.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))
			.map((entry) => this.#summary(entry))
	}

	async saveFromLocation(location: ControlLocation, name: string): Promise<ButtonFavoriteSummary> {
		const trimmed = name.trim()
		if (!trimmed) throw new Error('A name is required')

		const controlId = this.#pages.getControlIdAt(location)
		if (!controlId) throw new Error('That button is empty')

		const control = this.#controls.getControl(controlId)
		if (!control) throw new Error('That button is empty')

		const json = control.toJSON(true)
		if (!isFavoriteButton(json)) throw new Error('Only buttons can be saved as favorites')

		const described = describeButtonFavorite(json)
		const model: ButtonFavoriteModel = {
			id: nanoid(),
			name: trimmed,
			preview: await this.#preview(location),
			actionKind: described.actionKind,
			connections: described.connectionIds.map((connectionId) => this.#connectionSlot(connectionId)),
			pages: described.pageIds.map((pageId): FavoritePageSlot => ({ pageId })),
			surfaces: described.surfaceIds.map((surfaceId): FavoriteSurfaceSlot => ({ surfaceId })),
			control: json,
			createdAt: Date.now(),
		}

		this.#table.set(model.id, model)
		this.#logger.info(`Saved favorite ${model.id} from ${location.pageNumber}/${location.row}/${location.column}`)
		return this.#summary(model)
	}

	rename(favoriteId: string, name: string): void {
		const trimmed = name.trim()
		if (!trimmed) throw new Error('A name is required')

		const existing = this.#require(favoriteId)
		this.#table.set(favoriteId, { ...existing, name: trimmed })
	}

	remove(favoriteId: string): void {
		if (!this.#table.get(favoriteId)) throw new Error('Favorite not found')
		this.#table.delete(favoriteId)
		this.#logger.info(`Deleted favorite ${favoriteId}`)
	}

	place(
		favoriteId: string,
		location: ControlLocation,
		connections: { fromId: string; toId: string }[],
		pages: { fromId: string; toId: string }[],
		surfaces: { fromId: string; toId: string }[]
	): string | null {
		if (!this.#pages.isPageValid(location.pageNumber)) throw new Error('That page does not exist')

		const favorite = this.#require(favoriteId)
		const described = describeButtonFavorite(favorite.control)
		const connectionChoice = choiceMap(connections)
		const pageChoice = choiceMap(pages)
		const surfaceChoice = choiceMap(surfaces)

		const instanceIdMap: InstanceAppliedRemappings = {
			internal: { id: 'internal', label: 'internal' },
		}

		for (const connectionId of described.connectionIds) {
			const toId = connectionChoice.get(connectionId)
			if (!toId) throw new Error('Pick a connection for this button')

			const target = this.#connectionConfig(toId)
			if (!target) throw new Error('That connection does not exist')

			const stored = favorite.connections.find((slot) => slot.connectionId === connectionId)
			const source = this.#instances.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
			instanceIdMap[connectionId] = {
				id: toId,
				label: target.label,
				oldLabel: source?.label ?? stored?.label ?? connectionId,
				lastUpgradeIndex: target.lastUpgradeIndex,
			}
		}

		const pageIdRemap: Record<string, string> = {}
		for (const pageId of described.pageIds) {
			const toId = pageChoice.get(pageId)
			if (!toId || !this.#pages.isPageIdValid(toId)) throw new Error('Pick a page for this button')
			pageIdRemap[pageId] = toId
		}

		const outboundSurfaceIdRemap: Record<string, string> = {}
		for (const surfaceId of described.surfaceIds) {
			const toId = surfaceChoice.get(surfaceId)
			if (!toId) throw new Error('Pick a surface for this button')
			outboundSurfaceIdRemap[surfaceId] = toId
		}

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) connectionLabelRemap[info.oldLabel] = info.label
			if (info.id && info.id !== oldId) connectionIdRemap[oldId] = info.id
		}

		const referencesUpdater = new VisitorReferencesUpdater(
			this.#internalModule,
			connectionLabelRemap,
			connectionIdRemap,
			outboundSurfaceIdRemap,
			pageIdRemap
		)

		const control = favorite.control
		let fixed: SomeButtonModel
		if (control.type === 'pagenum' || control.type === 'pageup' || control.type === 'pagedown') {
			fixed = { type: control.type }
		} else if (control.type === 'button-layered') {
			fixed = fixupLayeredButtonControl(this.#logger, control, referencesUpdater, instanceIdMap)
		} else if (control.type === 'preset-reference') {
			fixed = fixupPresetReferenceControl(this.#logger, control, referencesUpdater, instanceIdMap)
		} else if (control.type === 'button-reference') {
			fixed = fixupButtonReferenceControl(control, referencesUpdater)
		} else {
			throw new Error('Only buttons can be placed from favorites')
		}

		const controlId = this.#controls.importControl(location, fixed)
		if (!controlId) throw new Error('The button could not be placed')

		this.#logger.info(`Placed favorite ${favoriteId} at ${location.pageNumber}/${location.row}/${location.column}`)
		return controlId
	}

	#summary(model: ButtonFavoriteModel): ButtonFavoriteSummary {
		return {
			id: model.id,
			name: model.name,
			preview: model.preview,
			actionKind: model.actionKind,
			connections: model.connections,
			pages: model.pages,
			surfaces: model.surfaces,
		}
	}

	#require(favoriteId: string): ButtonFavoriteModel {
		const found = this.#table.get(favoriteId)
		if (!found || !isFavoriteButton(found.control)) throw new Error('Favorite not found')
		return found
	}

	#connectionConfig(connectionId: string): InstanceConfig | undefined {
		return this.#instances.getInstanceConfigOfType(connectionId, ModuleInstanceType.Connection)
	}

	#connectionSlot(connectionId: string): FavoriteConnectionSlot {
		const config = this.#connectionConfig(connectionId)
		return {
			connectionId,
			label: config?.label ?? connectionId,
			moduleId: config?.moduleId ?? '',
		}
	}

	async #preview(location: ControlLocation): Promise<string | null> {
		try {
			const render = this.#graphics.getCachedRender(location)
			if (!render) return null
			const url = await render.drawNativeEncoded(72, 72, null, 'png')
			return url || null
		} catch (e) {
			this.#logger.debug(`Favorite preview skipped: ${e}`)
			return null
		}
	}
}

function choiceMap(choices: { fromId: string; toId: string }[]): Map<string, string> {
	return new Map(choices.map((choice) => [choice.fromId, choice.toId]))
}
