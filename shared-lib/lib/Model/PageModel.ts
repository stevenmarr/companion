import type { PageSurfaceLayoutId } from '../PageSurfaceLayout.js'

export interface PageModel {
	id: string
	name: string
	controls: Record<number, Record<number, string>>

	/**
	 * Surface this page is written for. Absent means the full button grid.
	 * Coordinates match that device, so a surface at the home corner shows the same cells.
	 */
	surfaceLayout?: PageSurfaceLayoutId | null

	/**
	 * Image for this page, recalled by the "Page: Show page image" feedback.
	 * Either `$(image:name)` from the image library, or a `data:image/...` URL.
	 */
	image?: string | null
}

export type PageModelChanges = PageModelChangesInit | PageModelChangesUpdate

export interface PageModelChangesInit {
	type: 'init'

	order: string[]

	pages: Record<string, PageModel | undefined>
}

export interface PageModelChangesUpdate {
	type: 'update'
	updatedOrder: string[] | null

	added: PageModel[]
	changes: PageModelChangesItem[]
}

export interface PageModelChangesItem {
	id: string
	name: string | null

	controls: Array<{ row: number; column: number; controlId: string | null }>

	/** Present only when the surface layout changed. null clears it. */
	surfaceLayout?: PageSurfaceLayoutId | null

	/** Present only when the page image changed. null clears it. */
	image?: string | null
}
