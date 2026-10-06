import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useState } from 'react'
import {
	getPageSurfaceLayout,
	gridGrowthForLayout,
	PAGE_SURFACE_LAYOUTS,
	type PageSurfaceLayoutId,
} from '@companion-app/shared/PageSurfaceLayout.js'
import { Button } from '~/Components/Button'
import type { DropdownChoicesOrGroups } from '~/Components/DropdownChoices.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { ImageInputField } from '~/Components/ImageInputField.js'
import { Modal } from '~/Components/Modal'
import { TextInputFieldSimple } from '~/Components/TextInputField'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export interface EditPagePropertiesModalRef {
	show(pageNumber: number, pageInfo: PagesStoreModel | undefined): void
}
interface EditPagePropertiesModalProps {
	includeName: boolean
}

const SURFACE_CHOICES: DropdownChoicesOrGroups = [
	{ id: '', label: 'Full grid' },
	...PAGE_SURFACE_LAYOUTS.map((layout) => ({
		id: layout.id,
		label: `${layout.label} — ${layout.summary}`,
	})),
]

export const EditPagePropertiesModal = observer(
	forwardRef<EditPagePropertiesModalRef, EditPagePropertiesModalProps>(function EditPagePropertiesModal(
		{ includeName },
		ref
	) {
		const { userConfig } = useContext(RootAppStoreContext)

		const [pageNumber, setPageNumber] = useState<number | null>(null)
		const [show, setShow] = useState(false)

		const [pageName, setName] = useState<string | null>(null)
		const [surfaceLayout, setSurfaceLayout] = useState<PageSurfaceLayoutId | null>(null)
		const [image, setImage] = useState<string | null>(null)
		const [originalName, setOriginalName] = useState<string | null>(null)
		const [originalLayout, setOriginalLayout] = useState<PageSurfaceLayoutId | null>(null)
		const [originalImage, setOriginalImage] = useState<string | null>(null)

		const setNameMutation = useMutationExt(trpc.pages.setName.mutationOptions())
		const setLayoutMutation = useMutationExt(trpc.pages.setSurfaceLayout.mutationOptions())
		const setImageMutation = useMutationExt(trpc.pages.setImage.mutationOptions())

		const doSave = useCallback(
			(e: React.SyntheticEvent) => {
				e.preventDefault()
				e.stopPropagation()

				setShow(false)

				if (pageNumber === null) return

				const saves: Promise<unknown>[] = []
				if (includeName && (pageName ?? '') !== (originalName ?? '')) {
					saves.push(setNameMutation.mutateAsync({ pageNumber, name: pageName ?? '' }))
				}
				if (surfaceLayout !== originalLayout) {
					saves.push(setLayoutMutation.mutateAsync({ pageNumber, surfaceLayout }))
				}
				if ((image ?? null) !== (originalImage ?? null)) {
					saves.push(setImageMutation.mutateAsync({ pageNumber, image }))
				}

				Promise.all(saves).catch((err) => {
					console.error('Failed to update page', err)
				})
			},
			[
				setNameMutation,
				setLayoutMutation,
				setImageMutation,
				includeName,
				pageNumber,
				pageName,
				originalName,
				surfaceLayout,
				originalLayout,
				image,
				originalImage,
			]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(pageNumber, pageInfo) {
					setName(pageInfo?.name ?? null)
					setOriginalName(pageInfo?.name ?? null)
					setSurfaceLayout(pageInfo?.surfaceLayout ?? null)
					setOriginalLayout(pageInfo?.surfaceLayout ?? null)
					setImage(pageInfo?.image ?? null)
					setOriginalImage(pageInfo?.image ?? null)
					setPageNumber(pageNumber)
					setShow(true)
				},
			}),
			[]
		)

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) {
				setPageNumber(null)
				setName(null)
				setSurfaceLayout(null)
				setImage(null)
			}
		}, [])

		const nameFieldId = useId()
		const surfaceFieldId = useId()
		const imageFieldId = useId()

		const selectedLayout = getPageSurfaceLayout(surfaceLayout)
		const gridSize = userConfig.properties?.gridSize
		const willGrowGrid = !!(selectedLayout && gridSize && gridGrowthForLayout(gridSize, selectedLayout))

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup>
							<Modal.Header closeButton>
								<Modal.Title>Configure Page {pageNumber}</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form
									onSubmit={(e) => {
										e.preventDefault()
										e.stopPropagation()
									}}
								>
									{includeName && (
										<Grid.Row className="mb-4">
											<FormLabel htmlFor={nameFieldId} sm={3} column="sm">
												Name
											</FormLabel>
											<Grid.Col sm={9}>
												<TextInputFieldSimple
													id={nameFieldId}
													value={pageName || ''}
													setValue={setName}
													immediateValue
												/>
											</Grid.Col>
										</Grid.Row>
									)}
									<Grid.Row className="mb-4">
										<FormLabel htmlFor={surfaceFieldId} sm={3} column="sm">
											Surface
										</FormLabel>
										<Grid.Col sm={9}>
											<DropdownInputField
												htmlName={surfaceFieldId}
												choices={SURFACE_CHOICES}
												value={surfaceLayout ?? ''}
												setValue={(value) =>
													setSurfaceLayout(value === '' || value == null ? null : (value as PageSurfaceLayoutId))
												}
											/>
											<div className="form-text">
												The button grid for this page uses that surface's rows and columns, including knobs and the
												touch strip. A surface at the home corner shows those same cells when the page is recalled. Full
												grid keeps today's rectangle.
											</div>
											{selectedLayout?.note && <div className="form-text">{selectedLayout.note}</div>}
											{willGrowGrid && (
												<div className="form-text">
													This layout is larger than the button grid. Saving grows the grid for every page, so the new
													cells exist. Other pages keep their buttons and gain empty rows and columns.
												</div>
											)}
											{selectedLayout && (
												<div className="form-text">
													Buttons already outside this surface stay on the page, but they are hidden while this surface
													is selected.
												</div>
											)}
										</Grid.Col>
									</Grid.Row>
									<Grid.Row className="mb-4">
										<FormLabel htmlFor={imageFieldId} sm={3} column="sm">
											Image
										</FormLabel>
										<Grid.Col sm={9}>
											{show && <ImageInputField id={imageFieldId} value={image} setValue={setImage} />}
											<div className="form-text">A button can show this with the feedback "Page: Show page image".</div>
										</Grid.Col>
									</Grid.Row>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button color="primary" onClick={doSave}>
									Save
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	})
)
