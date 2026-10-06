import { useContext, useEffect, useId, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { queryClient, trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface SaveFavoriteModalProps {
	location: ControlLocation | null
	onClose: () => void
}

export function SaveFavoriteModal({ location, onClose }: SaveFavoriteModalProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)
	const [name, setName] = useState('Favorite')
	const [busy, setBusy] = useState(false)
	const nameId = useId()
	const saveMutation = useMutationExt(trpc.buttonFavorites.saveFromLocation.mutationOptions())

	useEffect(() => {
		if (location) setName('Favorite')
	}, [location])

	const save = () => {
		if (!location) return
		setBusy(true)
		saveMutation
			.mutateAsync({ location, name })
			.then(() => {
				void queryClient.invalidateQueries({ queryKey: trpc.buttonFavorites.list.queryKey() })
				onClose()
				notifier.show('Favorite', `Saved ${name.trim() || 'button'}`, 3000)
			})
			.catch((e) => {
				notifier.show('Favorite', e instanceof Error ? e.message : String(e))
			})
			.finally(() => setBusy(false))
	}

	return (
		<Modal.Root open={!!location} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Save button as favorite</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								{location
									? `Button ${formatLocation(location)} is copied into Favorites, at the top of the Presets list.`
									: null}{' '}
								Dragging it onto the grid asks for a connection, page, or surface when the button uses one.
							</p>
							<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
								<FormLabel htmlFor={nameId} sm={4} column="sm">
									Name
								</FormLabel>
								<Grid.Col sm={8}>
									<TextInputField id={nameId} value={name} setValue={setName} immediateValue />
								</Grid.Col>
							</Form>
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy} onClick={save}>
								Save as favorite
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
