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

/** What `buttonFavorites.list` returns, and what a drag carries onto the grid. */
export interface ButtonFavoriteSummary {
	id: string
	name: string
	preview: string | null
	actionKind: FavoriteActionKind
	connections: FavoriteConnectionSlot[]
	pages: FavoritePageSlot[]
	surfaces: FavoriteSurfaceSlot[]
}

export interface FavoriteDragItem {
	favorite: ButtonFavoriteSummary
}

/** Drag type for a saved button. Grid cells must accept this or the drop is ignored. */
export const FAVORITE_DRAG_TYPE = 'favorite'

export function favoriteNeedsChoice(favorite: ButtonFavoriteSummary): boolean {
	return favorite.connections.length > 0 || favorite.pages.length > 0 || favorite.surfaces.length > 0
}

export function favoriteActionLabel(kind: FavoriteActionKind): string {
	switch (kind) {
		case 'press':
			return 'Press'
		case 'rotary':
			return 'Rotary'
		case 'both':
			return 'Press + rotary'
		case 'none':
			return 'No actions'
		default: {
			const neverKind: never = kind
			return neverKind
		}
	}
}
