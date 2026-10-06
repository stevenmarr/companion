import { Feedback } from '@dnd-kit/dom'
import { useDraggable } from '@dnd-kit/react'
import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { Button } from '~/Components/Button.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { queryClient, trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import {
	FAVORITE_DRAG_TYPE,
	favoriteActionLabel,
	type ButtonFavoriteSummary,
	type FavoriteDragItem,
} from './FavoriteDragItem.js'
import './Favorites.css'

const FAVORITE_FEEDBACK_PLUGINS = [Feedback.configure({ feedback: 'clone', dropAnimation: null })]

function refreshFavorites(): void {
	void queryClient.invalidateQueries({ queryKey: trpc.buttonFavorites.list.queryKey() })
}

export function FavoritePresets(): React.JSX.Element {
	const favoritesQuery = useQuery(trpc.buttonFavorites.list.queryOptions())
	const favorites = favoritesQuery.data ?? []

	return (
		<div className="favorite-presets">
			<h5>Favorites</h5>
			<p>Buttons you have saved. Drag one onto the grid. Press and rotary buttons are marked.</p>
			{favoritesQuery.isPending && <p>Loading favorites...</p>}
			{favoritesQuery.error && <p>Couldn't load favorites.</p>}
			{!favoritesQuery.isPending && favorites.length === 0 && (
				<p>No favorites yet. Right-click a button and choose Save as favorite.</p>
			)}
			{favorites.length > 0 && (
				<div className="presets-icon-grid favorite-presets-grid">
					{favorites.map((favorite) => (
						<FavoriteIcon key={favorite.id} favorite={favorite} />
					))}
				</div>
			)}
		</div>
	)
}

function FavoriteIcon({ favorite }: { favorite: ButtonFavoriteSummary }): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)
	const removeMutation = useMutationExt(trpc.buttonFavorites.remove.mutationOptions())
	const dragData: FavoriteDragItem = { favorite }
	const { ref: drag, isDragSource } = useDraggable<FavoriteDragItem>({
		id: `favorite:${favorite.id}`,
		type: FAVORITE_DRAG_TYPE,
		data: dragData,
		plugins: FAVORITE_FEEDBACK_PLUGINS,
	})

	return (
		<div className={`favorite-card${isDragSource ? ' favorite-card-dragging' : ''}`}>
			<ButtonPreviewBase fixedSize dragRef={drag} title={favorite.name} preview={favorite.preview} />
			<div className="favorite-card-name" title={favorite.name}>
				{favorite.name}
			</div>
			<div className={`favorite-kind favorite-kind-${favorite.actionKind}`}>
				{favoriteActionLabel(favorite.actionKind)}
			</div>
			<Button
				type="button"
				size="sm"
				color="light"
				className="favorite-remove"
				title={`Remove ${favorite.name}`}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => {
					event.stopPropagation()
					event.preventDefault()
					removeMutation
						.mutateAsync({ favoriteId: favorite.id })
						.then(refreshFavorites)
						.catch((e) => {
							notifier.show('Favorite', e instanceof Error ? e.message : String(e))
						})
				}}
			>
				Remove
			</Button>
		</div>
	)
}
