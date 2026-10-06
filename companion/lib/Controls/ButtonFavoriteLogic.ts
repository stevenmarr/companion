import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import { literalInternalPageId } from '../Internal/PageReference.js'

/** Whether the saved button does something on a press, a rotary turn, or both. */
export type FavoriteActionKind = 'press' | 'rotary' | 'both' | 'none'

export interface FavoriteConnectionSlot {
	connectionId: string
	label: string
	moduleId: string
}

export interface FavoritePageSlot {
	pageId: string
}

export interface FavoriteSurfaceSlot {
	surfaceId: string
}

/** What the presets list shows. The button itself stays on the server. */
export interface ButtonFavoriteSummary {
	id: string
	name: string
	preview: string | null
	actionKind: FavoriteActionKind
	connections: FavoriteConnectionSlot[]
	pages: FavoritePageSlot[]
	surfaces: FavoriteSurfaceSlot[]
}

export interface ButtonFavoriteDescription {
	actionKind: FavoriteActionKind
	connectionIds: string[]
	pageIds: string[]
	surfaceIds: string[]
}

const BUTTON_TYPES = new Set<SomeButtonModel['type']>([
	'button-layered',
	'preset-reference',
	'button-reference',
	'pageup',
	'pagenum',
	'pagedown',
])

export function isFavoriteButton(control: unknown): control is SomeButtonModel {
	return !!control && typeof control === 'object' && BUTTON_TYPES.has((control as SomeButtonModel).type)
}

export function favoriteActionKind(control: SomeButtonModel): FavoriteActionKind {
	if (control.type === 'pageup' || control.type === 'pagedown' || control.type === 'pagenum') return 'press'
	if (!('steps' in control)) return 'none'

	let press = false
	let rotary = false
	for (const step of Object.values(control.steps)) {
		for (const [setId, actions] of Object.entries(step.action_sets)) {
			if (!actions || actions.length === 0) continue
			if (setId === 'rotate_left' || setId === 'rotate_right') rotary = true
			else press = true
		}
	}

	if (press && rotary) return 'both'
	if (rotary) return 'rotary'
	if (press) return 'press'
	return 'none'
}

/**
 * Connections, concrete pages, and concrete surfaces a saved button needs before it can be placed.
 * Relative pages (`0`, startup, back, forward, +1, -1) and `self` are not a choice.
 */
export function describeButtonFavorite(control: SomeButtonModel): ButtonFavoriteDescription {
	const connectionIds = new Set<string>()
	const pageIds = new Set<string>()
	const surfaceIds = new Set<string>()

	if (control.type === 'preset-reference') {
		const connectionId = control.presetRef?.connectionId
		if (connectionId && connectionId !== 'internal') connectionIds.add(connectionId)
	}

	eachEntity(control, (entity) => {
		if (entity.connectionId && entity.connectionId !== 'internal') connectionIds.add(entity.connectionId)

		const pageId = literalInternalPageId(entity.definitionId, entity.options)
		if (pageId) pageIds.add(pageId)

		const surfaceId = literalSurfaceId(entity.options)
		if (surfaceId) surfaceIds.add(surfaceId)
	})

	return {
		actionKind: favoriteActionKind(control),
		connectionIds: [...connectionIds].sort(),
		pageIds: [...pageIds].sort(),
		surfaceIds: [...surfaceIds].sort(),
	}
}

function eachEntity(control: SomeButtonModel, visit: (entity: SomeEntityModel) => void): void {
	if (!('steps' in control)) return

	const walk = (entities: SomeEntityModel[] | undefined): void => {
		if (!entities) return
		for (const entity of entities) {
			if (!entity) continue
			visit(entity)
			if (entity.children) {
				for (const children of Object.values(entity.children)) walk(children)
			}
		}
	}

	walk(control.feedbacks)
	walk(control.localVariables)
	for (const step of Object.values(control.steps)) {
		for (const actions of Object.values(step.action_sets)) walk(actions)
	}
}

function literalSurfaceId(options: ExpressionableOptionsObject | undefined): string | null {
	const option = options?.surfaceId
	if (!option || option.isExpression || typeof option.value !== 'string') return null

	const id = option.value.trim()
	if (!id || id === 'self') return null
	return id
}
