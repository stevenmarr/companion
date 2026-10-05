import { describe, expect, test } from 'vitest'
import {
	isInternalPageMissing,
	resolveInternalPage,
	upgradeInternalPageReference,
} from '../../lib/Internal/PageReference.js'
import { createStore, threePages } from '../Page/Helpers.js'

describe('resolveInternalPage', () => {
	test('a page id follows that page rather than its slot', () => {
		const { store } = createStore(threePages())

		expect(resolveInternalPage('page-c', store, 1)).toEqual({ kind: 'page', pageId: 'page-c', pageNumber: 3 })
	})

	test('a legacy page number is the page currently in that slot', () => {
		const { store } = createStore(threePages())

		expect(resolveInternalPage(2, store, 1)).toEqual({ kind: 'page', pageId: 'page-b', pageNumber: 2 })
		expect(resolveInternalPage('2', store, 1)).toEqual({ kind: 'page', pageId: 'page-b', pageNumber: 2 })
	})

	test('0 is the control page', () => {
		const { store } = createStore(threePages())

		expect(resolveInternalPage(0, store, 3)).toEqual({ kind: 'page', pageId: 'page-c', pageNumber: 3 })
		expect(resolveInternalPage('0', store, null)).toEqual({ kind: 'missing' })
	})

	test('relative tokens stay relative', () => {
		const { store } = createStore(threePages())

		expect(resolveInternalPage('back', store, 1)).toEqual({ kind: 'relative', token: 'back' })
		expect(resolveInternalPage('startup', store, 1)).toEqual({ kind: 'relative', token: 'startup' })
	})

	test('a deleted page id is missing', () => {
		const { store } = createStore(threePages())

		expect(resolveInternalPage('page-gone', store, 1)).toEqual({ kind: 'missing' })
		expect(isInternalPageMissing('page-gone', store, 1)).toBe(true)
		expect(isInternalPageMissing(0, store, 1)).toBe(false)
		expect(isInternalPageMissing('forward', store, 1)).toBe(false)
	})
})

describe('upgradeInternalPageReference', () => {
	test('rewrites a stored page number to the id in that slot', () => {
		const { store } = createStore(threePages())
		const action = {
			definitionId: 'set_page',
			options: { page: { isExpression: false as const, value: 3 } },
		}

		expect(upgradeInternalPageReference(action, store)).toBe(true)
		expect(action.options.page.value).toBe('page-c')
	})

	test('leaves an id, an expression, this-page, and unrelated actions alone', () => {
		const { store } = createStore(threePages())
		const alreadyId = {
			definitionId: 'set_page',
			options: { page: { isExpression: false as const, value: 'page-a' } },
		}
		const expression = {
			definitionId: 'surface_on_page',
			options: { page: { isExpression: true as const, value: '1 + 1' } },
		}
		const thisPage = {
			definitionId: 'panic_page',
			options: { page: { isExpression: false as const, value: 0 } },
		}
		const brightness = {
			definitionId: 'set_brightness',
			options: { page: { isExpression: false as const, value: 2 } },
		}

		expect(upgradeInternalPageReference(alreadyId, store)).toBe(false)
		expect(upgradeInternalPageReference(expression, store)).toBe(false)
		expect(upgradeInternalPageReference(thisPage, store)).toBe(false)
		expect(upgradeInternalPageReference(brightness, store)).toBe(false)
		expect(brightness.options.page.value).toBe(2)
	})
})
