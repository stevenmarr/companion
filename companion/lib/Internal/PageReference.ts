import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { IPageStore } from '../Page/Store.js'

/**
 * Internal actions and feedbacks whose `page` option is an `internal:page` picker.
 * Action Recorder's `page` field is a free-text location and is intentionally not included.
 */
const PAGE_REFERENCE_DEFINITIONS = new Set([
	'set_page',
	'set_page_byindex',
	'surface_on_page',
	'page_missing',
	'panic_page',
	'page_variable_set_value',
	'page_variable_reset_to_default',
	'page_variable_sync_to_default',
])

const RELATIVE_PAGE_TOKENS = new Set(['startup', 'back', 'forward', '+1', '-1'])

export type RelativePageToken = 'startup' | 'back' | 'forward' | '+1' | '-1'

export type ResolvedInternalPage =
	| { kind: 'page'; pageId: string; pageNumber: number }
	| { kind: 'relative'; token: RelativePageToken }
	| { kind: 'missing' }

function isRelativePageToken(value: unknown): value is RelativePageToken {
	return typeof value === 'string' && RELATIVE_PAGE_TOKENS.has(value)
}

/**
 * A legacy page reference is a positive page number (or its decimal string).
 * `0` means "this page" and is not a legacy absolute reference.
 */
function parseLegacyPageNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isInteger(value)) return value
	if (typeof value === 'string' && /^-?\d+$/.test(value)) {
		const parsed = Number(value)
		return Number.isInteger(parsed) ? parsed : null
	}
	return null
}

/**
 * Resolve an `internal:page` option.
 *
 * A stored page id follows that page when pages are inserted or reordered.
 * A plain number is the pre-id behaviour: whatever page currently occupies that slot.
 * `0` is the page the control is on. `startup`, `back`, `forward`, `+1` and `-1` stay relative.
 * Anything else (typically a page id whose page was deleted) is missing.
 */
export function resolveInternalPage(
	raw: unknown,
	pageStore: IPageStore,
	thisPageNumber: number | null | undefined
): ResolvedInternalPage {
	if (raw === 0 || raw === '0') {
		const pageNumber = thisPageNumber ?? null
		if (pageNumber === null || pageNumber <= 0) return { kind: 'missing' }
		const pageId = pageStore.getPageId(pageNumber)
		if (!pageId) return { kind: 'missing' }
		return { kind: 'page', pageId, pageNumber }
	}

	if (isRelativePageToken(raw)) return { kind: 'relative', token: raw }

	if (typeof raw === 'string' && raw !== '' && pageStore.isPageIdValid(raw)) {
		const pageNumber = pageStore.getPageNumber(raw)
		if (pageNumber === null) return { kind: 'missing' }
		return { kind: 'page', pageId: raw, pageNumber }
	}

	const pageNumber = parseLegacyPageNumber(raw)
	if (pageNumber !== null && pageNumber > 0) {
		const pageId = pageStore.getPageId(pageNumber)
		if (!pageId) return { kind: 'missing' }
		return { kind: 'page', pageId, pageNumber }
	}

	return { kind: 'missing' }
}

/**
 * True when the option names a specific page that no longer exists.
 * Relative targets (`0`, startup, back, forward, +/-1) are never "missing".
 */
export function isInternalPageMissing(
	raw: unknown,
	pageStore: IPageStore,
	thisPageNumber: number | null | undefined
): boolean {
	if (raw === 0 || raw === '0' || isRelativePageToken(raw)) return false
	return resolveInternalPage(raw, pageStore, thisPageNumber).kind === 'missing'
}

/**
 * Rewrite a stored page number to the id of the page currently in that slot.
 * Expressions, relative tokens, and values that are already a live page id are left alone.
 * Returns whether the entity was modified.
 */
export function upgradeInternalPageReference(
	entity: { definitionId: string; options: ExpressionableOptionsObject },
	pageStore: IPageStore
): boolean {
	if (!PAGE_REFERENCE_DEFINITIONS.has(entity.definitionId)) return false

	const option = entity.options.page
	if (!option || option.isExpression) return false

	const value = option.value
	if (value === 0 || value === '0' || isRelativePageToken(value)) return false
	if (typeof value === 'string' && pageStore.isPageIdValid(value)) return false

	const pageNumber = parseLegacyPageNumber(value)
	if (pageNumber === null || pageNumber <= 0) return false

	const pageId = pageStore.getPageId(pageNumber)
	if (!pageId) return false

	option.value = pageId
	return true
}
