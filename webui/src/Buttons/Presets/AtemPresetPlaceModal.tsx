import { useEffect, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Modal } from '~/Components/Modal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { PresetDragItem } from './PresetDragItem.js'

export interface AtemPresetDrop {
	item: PresetDragItem
	location: ControlLocation
}

const MIX_EFFECTS = [1, 2, 3, 4].map((value) => ({ id: String(value), label: `ME ${value}` }))
const UPSTREAM_KEYERS = [1, 2, 3, 4].map((value) => ({ id: String(value), label: `Key ${value}` }))
const DOWNSTREAM_KEYERS = [1, 2, 3, 4].map((value) => ({ id: String(value), label: `DSK ${value}` }))

interface AtemPresetPlaceModalProps {
	pending: AtemPresetDrop | null
	onClose: () => void
}

export function AtemPresetPlaceModal({ pending, onClose }: AtemPresetPlaceModalProps): React.JSX.Element {
	const [mixEffect, setMixEffect] = useState('1')
	const [keyer, setKeyer] = useState('1')
	const [busy, setBusy] = useState(false)
	const importPreset = useMutationExt(trpc.controls.importPreset.mutationOptions())
	const downstream = pending?.item.presetId.startsWith('dsk_') ?? false

	useEffect(() => {
		if (!pending) return
		setMixEffect('1')
		setKeyer('1')
		setBusy(false)
	}, [pending])

	const place = () => {
		if (!pending) return
		setBusy(true)
		importPreset
			.mutateAsync({
				connectionId: pending.item.connectionId,
				presetId: pending.item.presetId,
				location: pending.location,
				mode: pending.item.mode,
				variableValues: downstream ? { keyer: Number(keyer) } : { me: Number(mixEffect), keyer: Number(keyer) },
			})
			.then(() => onClose())
			.catch(() => {
				console.error('Preset import failed')
			})
			.finally(() => setBusy(false))
	}

	return (
		<Modal.Root open={!!pending} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>{downstream ? 'Which downstream keyer?' : 'Which mix effect and keyer?'}</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								{pending
									? `This knob goes on ${formatLocation(pending.location)}. ${
											downstream
												? 'Choose the downstream keyer it will adjust.'
												: 'Choose the mix effect and upstream keyer it will adjust.'
										} You can change that later on the button.`
									: null}
							</p>
							{downstream ? null : (
								<div className="page-class-slot">
									<p className="font-bold">Mix effect</p>
									<SimpleDropdownInputField
										id={undefined}
										value={mixEffect}
										setValue={(value) => setMixEffect(String(value))}
										choices={MIX_EFFECTS}
									/>
								</div>
							)}
							<div className="page-class-slot">
								<p className="font-bold">{downstream ? 'Downstream keyer' : 'Upstream keyer'}</p>
								<SimpleDropdownInputField
									id={undefined}
									value={keyer}
									setValue={(value) => setKeyer(String(value))}
									choices={downstream ? DOWNSTREAM_KEYERS : UPSTREAM_KEYERS}
								/>
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy} onClick={place}>
								Place knob
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
