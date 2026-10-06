import { describe, expect, test } from 'vitest'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { describeButtonFavorite, favoriteActionKind } from '../../lib/Controls/ButtonFavoriteLogic.js'

function entity(
	partial: Partial<SomeEntityModel> & Pick<SomeEntityModel, 'connectionId' | 'definitionId'>
): SomeEntityModel {
	return {
		type: 'action',
		id: 'entity',
		options: {},
		upgradeIndex: 0,
		...partial,
	} as SomeEntityModel
}

function button(actionSets: Record<string, SomeEntityModel[]>, extra?: Partial<SomeButtonModel>): SomeButtonModel {
	return {
		type: 'button-layered',
		options: { rotaryActions: true, canModifyStyleInApis: false, stepProgression: 'auto' },
		style: { layers: [] },
		feedbacks: [],
		localVariables: [],
		steps: {
			'0': {
				action_sets: actionSets,
				options: { runWhileHeld: [] },
			},
		},
		...extra,
	} as SomeButtonModel
}

describe('button favorites', () => {
	test('a press and a rotary are marked separately', () => {
		expect(favoriteActionKind(button({ down: [entity({ connectionId: 'cam', definitionId: 'go' })] }))).toBe('press')
		expect(favoriteActionKind(button({ rotate_left: [entity({ connectionId: 'cam', definitionId: 'turn' })] }))).toBe(
			'rotary'
		)
		expect(
			favoriteActionKind(
				button({
					up: [entity({ connectionId: 'cam', definitionId: 'go' })],
					rotate_right: [entity({ connectionId: 'cam', definitionId: 'turn' })],
				})
			)
		).toBe('both')
		expect(favoriteActionKind(button({}))).toBe('none')
		expect(favoriteActionKind({ type: 'pageup' })).toBe('press')
	})

	test('a connection, a concrete page, and a surface each become one slot', () => {
		const described = describeButtonFavorite(
			button({
				down: [
					entity({
						connectionId: 'internal',
						definitionId: 'set_page',
						options: { page: { value: 'page-a', isExpression: false } },
						children: {
							group: [entity({ connectionId: 'cam-1', definitionId: 'recall' })],
						},
					}),
					entity({
						connectionId: 'internal',
						definitionId: 'set_page',
						options: { page: { value: 0, isExpression: false } },
					}),
					entity({
						connectionId: 'internal',
						definitionId: 'set_page',
						options: { page: { value: 'startup', isExpression: false } },
					}),
					entity({
						connectionId: 'internal',
						definitionId: 'set_page',
						options: { page: { value: '$(internal:page)', isExpression: true } },
					}),
					entity({
						connectionId: 'internal',
						definitionId: 'set_brightness',
						options: { surfaceId: { value: 'self', isExpression: false } },
					}),
					entity({
						connectionId: 'internal',
						definitionId: 'set_brightness',
						options: { surfaceId: { value: 'deck-9', isExpression: false } },
					}),
				],
			})
		)

		expect(described.connectionIds).toEqual(['cam-1'])
		expect(described.pageIds).toEqual(['page-a'])
		expect(described.surfaceIds).toEqual(['deck-9'])
		expect(described.actionKind).toBe('press')
	})

	test('a preset reference asks for that connection', () => {
		const described = describeButtonFavorite({
			type: 'preset-reference',
			options: { rotaryActions: false, canModifyStyleInApis: false, stepProgression: 'auto' },
			style: { layers: [] },
			feedbacks: [],
			localVariables: [],
			steps: {},
			presetRef: { connectionId: 'ptz', moduleId: 'panasonic-ptz', presetId: 'recall', variableValues: null },
		})

		expect(described.connectionIds).toEqual(['ptz'])
	})
})
