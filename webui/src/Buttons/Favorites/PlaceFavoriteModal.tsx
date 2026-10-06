import { observer } from 'mobx-react-lite'
import { useContext, useEffect, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Modal } from '~/Components/Modal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { ButtonFavoriteSummary } from './FavoriteDragItem.js'

export interface FavoriteDrop {
	favorite: ButtonFavoriteSummary
	location: ControlLocation
}

interface PlaceFavoriteModalProps {
	pending: FavoriteDrop | null
	onClose: () => void
}

export const PlaceFavoriteModal = observer(function PlaceFavoriteModal({
	pending,
	onClose,
}: PlaceFavoriteModalProps): React.JSX.Element {
	const { connections, notifier, pages, surfaces } = useContext(RootAppStoreContext)
	const [connectionChoice, setConnectionChoice] = useState<Record<string, string>>({})
	const [pageChoice, setPageChoice] = useState<Record<string, string>>({})
	const [surfaceChoice, setSurfaceChoice] = useState<Record<string, string>>({})
	const [busy, setBusy] = useState(false)
	const placeMutation = useMutationExt(trpc.buttonFavorites.place.mutationOptions())

	useEffect(() => {
		if (!pending) return

		const nextConnections: Record<string, string> = {}
		for (const slot of pending.favorite.connections) {
			const sameModule = slot.moduleId ? connections.getAllOfModuleId(slot.moduleId) : []
			const stillThere = sameModule.some((connection) => connection.id === slot.connectionId)
			nextConnections[slot.connectionId] = stillThere ? slot.connectionId : (sameModule[0]?.id ?? '')
		}
		setConnectionChoice(nextConnections)

		const nextPages: Record<string, string> = {}
		for (const slot of pending.favorite.pages) {
			const stillThere = pages.data.some((page) => page.id === slot.pageId)
			nextPages[slot.pageId] = stillThere ? slot.pageId : (pages.data[0]?.id ?? '')
		}
		setPageChoice(nextPages)

		const surfaceChoices = listSurfaces(surfaces)
		const nextSurfaces: Record<string, string> = {}
		for (const slot of pending.favorite.surfaces) {
			const stillThere = surfaceChoices.some((choice) => choice.id === slot.surfaceId)
			nextSurfaces[slot.surfaceId] = stillThere ? slot.surfaceId : (surfaceChoices[0]?.id ?? '')
		}
		setSurfaceChoice(nextSurfaces)
	}, [pending, connections, pages, surfaces])

	const place = () => {
		if (!pending) return
		setBusy(true)
		placeMutation
			.mutateAsync({
				favoriteId: pending.favorite.id,
				location: pending.location,
				connections: pending.favorite.connections.map((slot) => ({
					fromId: slot.connectionId,
					toId: connectionChoice[slot.connectionId] ?? '',
				})),
				pages: pending.favorite.pages.map((slot) => ({
					fromId: slot.pageId,
					toId: pageChoice[slot.pageId] ?? '',
				})),
				surfaces: pending.favorite.surfaces.map((slot) => ({
					fromId: slot.surfaceId,
					toId: surfaceChoice[slot.surfaceId] ?? '',
				})),
			})
			.then(() => onClose())
			.catch((e) => {
				notifier.show('Favorite', e instanceof Error ? e.message : String(e))
			})
			.finally(() => setBusy(false))
	}

	const favorite = pending?.favorite
	const surfaceChoices = listSurfaces(surfaces)
	const pageChoices = pages.data.map((page, index) => ({
		id: page.id,
		label: page.name ? `${index + 1} (${page.name})` : `Page ${index + 1}`,
	}))

	const missingChoice =
		!!favorite &&
		(favorite.connections.some((slot) => !connectionChoice[slot.connectionId]) ||
			favorite.pages.some((slot) => !pageChoice[slot.pageId]) ||
			favorite.surfaces.some((slot) => !surfaceChoice[slot.surfaceId]))

	return (
		<Modal.Root open={!!pending} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>Place {favorite?.name}</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								{pending
									? `This goes on ${formatLocation(pending.location)}. Pick where the saved button should point. The favorite itself is not changed.`
									: null}
							</p>
							{favorite?.connections.map((slot) => {
								const sameModule = slot.moduleId ? connections.getAllOfModuleId(slot.moduleId) : []
								const choices =
									sameModule.length > 0
										? sameModule.map((connection) => ({ id: connection.id, label: connection.label }))
										: connections.sortedConnections().map((connection) => ({
												id: connection.id,
												label: connection.label,
											}))
								return (
									<div key={slot.connectionId} className="page-class-slot">
										<p className="font-bold">
											Connection {slot.label}{' '}
											{slot.moduleId ? <span className="page-class-meta">{slot.moduleId}</span> : null}
										</p>
										{choices.length === 0 ? (
											<p>There is no connection to use yet.</p>
										) : (
											<SimpleDropdownInputField
												id={undefined}
												value={connectionChoice[slot.connectionId] ?? ''}
												setValue={(value) =>
													setConnectionChoice((current) => ({ ...current, [slot.connectionId]: String(value) }))
												}
												choices={choices}
											/>
										)}
									</div>
								)
							})}
							{favorite?.pages.map((slot) => {
								const saved = pages.data.find((page) => page.id === slot.pageId)
								return (
									<div key={slot.pageId} className="page-class-slot">
										<p className="font-bold">Page {saved?.name || 'saved page'}</p>
										{pageChoices.length === 0 ? (
											<p>There is no page to use yet.</p>
										) : (
											<SimpleDropdownInputField
												id={undefined}
												value={pageChoice[slot.pageId] ?? ''}
												setValue={(value) => setPageChoice((current) => ({ ...current, [slot.pageId]: String(value) }))}
												choices={pageChoices}
											/>
										)}
									</div>
								)
							})}
							{favorite?.surfaces.map((slot) => (
								<div key={slot.surfaceId} className="page-class-slot">
									<p className="font-bold">Surface</p>
									{surfaceChoices.length === 0 ? (
										<p>There is no surface to use yet.</p>
									) : (
										<SimpleDropdownInputField
											id={undefined}
											value={surfaceChoice[slot.surfaceId] ?? ''}
											setValue={(value) =>
												setSurfaceChoice((current) => ({ ...current, [slot.surfaceId]: String(value) }))
											}
											choices={surfaceChoices}
										/>
									)}
								</div>
							))}
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy || missingChoice} onClick={place}>
								Place button
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

function listSurfaces(surfaces: {
	store: {
		values(): Iterable<{
			id: string
			displayName: string
			isAutoGroup: boolean
			surfaces: { id: string; displayName: string }[]
		}>
	}
	outboundSurfaces: { values(): Iterable<{ id: string; displayName: string }> }
}): { id: string; label: string }[] {
	const choices: { id: string; label: string }[] = []
	const seen = new Set<string>()

	const add = (id: string, label: string) => {
		if (!id || seen.has(id)) return
		seen.add(id)
		choices.push({ id, label })
	}

	for (const group of surfaces.store.values()) {
		if (!group) continue
		if (!group.isAutoGroup) add(group.id, `${group.displayName} (group)`)
		for (const surface of group.surfaces) add(surface.id, surface.displayName)
	}
	for (const outbound of surfaces.outboundSurfaces.values()) add(outbound.id, outbound.displayName)

	return choices
}
