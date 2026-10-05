import { faClone, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { PageClassSummary } from '@companion-app/shared/Model/PageClassModel.js'
import { suggestNextLabel } from '@companion-app/shared/PageClass.js'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField, TextInputFieldSimple } from '~/Components/TextInputField.js'
import { queryClient, trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface PageClassesSectionProps {
	pageNumber: number
	setPageNumber: (pageNumber: number) => void
}

function refreshPageClasses(): void {
	void queryClient.invalidateQueries({ queryKey: trpc.pageClasses.list.queryKey() })
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export const PageClassesSection = observer(function PageClassesSection({
	pageNumber,
	setPageNumber,
}: PageClassesSectionProps): React.JSX.Element {
	const { notifier, pages } = useContext(RootAppStoreContext)
	const classesQuery = useQuery(trpc.pageClasses.list.queryOptions())
	const classes = classesQuery.data ?? []

	const [saveOpen, setSaveOpen] = useState(false)
	const [instantiateClass, setInstantiateClass] = useState<PageClassSummary | null>(null)
	const [updateClass, setUpdateClass] = useState<PageClassSummary | null>(null)
	const deleteRef = useRef<GenericConfirmModalRef>(null)

	const renameMutation = useMutationExt(trpc.pageClasses.rename.mutationOptions())
	const removeMutation = useMutationExt(trpc.pageClasses.remove.mutationOptions())

	const currentPageName = pages.get(pageNumber)?.name ?? ''

	const rename = useCallback(
		(classId: string, name: string) => {
			renameMutation
				.mutateAsync({ classId, name })
				.then(refreshPageClasses)
				.catch((e) => {
					notifier.show('Page class', errorText(e))
				})
		},
		[notifier, renameMutation]
	)

	const askDelete = useCallback(
		(pageClass: PageClassSummary) => {
			deleteRef.current?.show(
				'Delete page class?',
				[`Delete the class "${pageClass.name}"?`, 'Pages you already created from it are not deleted.'],
				'Delete',
				() => {
					removeMutation
						.mutateAsync({ classId: pageClass.id })
						.then(refreshPageClasses)
						.catch((e) => {
							notifier.show('Page class', errorText(e))
						})
				}
			)
		},
		[notifier, removeMutation]
	)

	return (
		<div className="page-classes">
			<h5>Page classes</h5>
			<p>
				Save a finished page as a class, then stamp it out for the next device. A new page is created and its buttons
				are pointed at the connection you choose. Changing the class later does not change pages you already created.
			</p>
			<Button color="primary" size="sm" onClick={() => setSaveOpen(true)}>
				<FontAwesomeIcon icon={faClone} /> Save page {pageNumber} as class
			</Button>

			<GenericConfirmModal ref={deleteRef} />
			<SavePageClassModal
				open={saveOpen}
				onOpenChange={setSaveOpen}
				pageNumber={pageNumber}
				defaultName={currentPageName}
			/>
			<InstantiatePageClassModal
				pageClass={instantiateClass}
				onClose={() => setInstantiateClass(null)}
				onCreated={setPageNumber}
			/>
			<UpdatePageClassModal pageClass={updateClass} onClose={() => setUpdateClass(null)} />

			{classesQuery.isPending && <p>Loading page classes...</p>}
			{classesQuery.error && <p>Couldn't load page classes.</p>}
			{!classesQuery.isPending && classes.length === 0 && <p>No page classes yet.</p>}

			<div className="collections-nesting-table page-class-list">
				{classes.map((pageClass) => (
					<PageClassRow
						key={pageClass.id}
						pageClass={pageClass}
						onRename={rename}
						onInstantiate={setInstantiateClass}
						onUpdate={setUpdateClass}
						onDelete={askDelete}
					/>
				))}
			</div>
		</div>
	)
})

interface PageClassRowProps {
	pageClass: PageClassSummary
	onRename: (classId: string, name: string) => void
	onInstantiate: (pageClass: PageClassSummary) => void
	onUpdate: (pageClass: PageClassSummary) => void
	onDelete: (pageClass: PageClassSummary) => void
}

function PageClassRow({
	pageClass,
	onRename,
	onInstantiate,
	onUpdate,
	onDelete,
}: PageClassRowProps): React.JSX.Element {
	const [name, setName] = useState(pageClass.name)

	useEffect(() => {
		setName(pageClass.name)
	}, [pageClass.name])

	const slotText =
		pageClass.slots.length === 0
			? 'No connections'
			: pageClass.slots.map((slot) => `${slot.label} (${slot.moduleId})`).join(', ')

	return (
		<div className="collections-nesting-table-row-item">
			<div className="collections-nesting-table-row-item-grid">
				<div className="grow flex items-center gap-2">
					<div className="grow">
						<TextInputFieldSimple
							id={undefined}
							value={name}
							setValue={setName}
							placeholder="Class name"
							onBlur={() => {
								const trimmed = name.trim()
								if (trimmed && trimmed !== pageClass.name) onRename(pageClass.id, trimmed)
							}}
						/>
						<div className="page-class-meta">
							Saved from {pageClass.sourcePageName}. {slotText}
						</div>
					</div>
					<ButtonGroup className="page-class-actions ms-auto">
						<Button color="primary" size="sm" onClick={() => onInstantiate(pageClass)}>
							New page
						</Button>
						<Button color="secondary" size="sm" onClick={() => onUpdate(pageClass)}>
							Update
						</Button>
						<Button color="warning" size="sm" onClick={() => onDelete(pageClass)} title="Delete class">
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</ButtonGroup>
				</div>
			</div>
		</div>
	)
}

interface SavePageClassModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	pageNumber: number
	defaultName: string
}

export function SavePageClassModal({
	open,
	onOpenChange,
	pageNumber,
	defaultName,
}: SavePageClassModalProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)
	const [name, setName] = useState(defaultName)
	const [busy, setBusy] = useState(false)
	const nameId = useId()
	const saveMutation = useMutationExt(trpc.pageClasses.saveFromPage.mutationOptions())

	useEffect(() => {
		if (open) setName(defaultName)
	}, [open, defaultName])

	const save = () => {
		setBusy(true)
		saveMutation
			.mutateAsync({ pageNumber, name })
			.then(() => {
				refreshPageClasses()
				onOpenChange(false)
				notifier.show('Page class', `Saved page ${pageNumber} as a class`, 3000)
			})
			.catch((e) => {
				notifier.show('Page class', errorText(e))
			})
			.finally(() => setBusy(false))
	}

	return (
		<Modal.Root open={open} onOpenChange={onOpenChange}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Save page {pageNumber} as a class</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								The class keeps a copy of this page and of each connection's settings, including any password, so the
								next camera can be created from it.
							</p>
							<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
								<FormLabel htmlFor={nameId} sm={4} column="sm">
									Class name
								</FormLabel>
								<Grid.Col sm={8}>
									<TextInputField id={nameId} value={name} setValue={setName} immediateValue />
								</Grid.Col>
							</Form>
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy} onClick={save}>
								Save class
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}

interface SlotDraft {
	mode: 'clone' | 'existing'
	existingConnectionId: string
	label: string
	host: string
}

const InstantiatePageClassModal = observer(function InstantiatePageClassModal({
	pageClass,
	onClose,
	onCreated,
}: {
	pageClass: PageClassSummary | null
	onClose: () => void
	onCreated: (pageNumber: number) => void
}): React.JSX.Element {
	const { connections, notifier } = useContext(RootAppStoreContext)
	const [pageName, setPageName] = useState('')
	const [drafts, setDrafts] = useState<Record<string, SlotDraft>>({})
	const [busy, setBusy] = useState(false)
	const pageNameId = useId()
	const instantiateMutation = useMutationExt(trpc.pageClasses.instantiate.mutationOptions())

	useEffect(() => {
		if (!pageClass) return
		const taken = new Set<string>()
		for (const connection of connections.connections.values()) taken.add(connection.label)

		const next: Record<string, SlotDraft> = {}
		for (const slot of pageClass.slots) {
			const label = suggestNextLabel(slot.label, taken)
			taken.add(label)
			next[slot.connectionId] = {
				mode: 'clone',
				existingConnectionId: connections.getAllOfModuleId(slot.moduleId)[0]?.id ?? '',
				label,
				host: '',
			}
		}
		setDrafts(next)
		setPageName(pageClass.slots.length === 1 ? (Object.values(next)[0]?.label ?? pageClass.name) : pageClass.name)
	}, [pageClass, connections])

	const setDraft = (connectionId: string, patch: Partial<SlotDraft>) => {
		setDrafts((current) => ({ ...current, [connectionId]: { ...current[connectionId], ...patch } }))
	}

	const create = () => {
		if (!pageClass) return
		setBusy(true)
		instantiateMutation
			.mutateAsync({
				classId: pageClass.id,
				pageName,
				bindings: pageClass.slots.map((slot) => {
					const draft = drafts[slot.connectionId]
					return {
						connectionId: slot.connectionId,
						mode: draft?.mode ?? 'clone',
						existingConnectionId: draft?.existingConnectionId,
						label: draft?.label,
						host: draft?.host,
					}
				}),
			})
			.then((result) => {
				onClose()
				onCreated(result.pageNumber)
				notifier.show('Page class', `Created page ${result.pageNumber}`, 3000)
			})
			.catch((e) => {
				notifier.show('Page class', errorText(e))
			})
			.finally(() => setBusy(false))
	}

	return (
		<Modal.Root open={!!pageClass} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>New page from {pageClass?.name}</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								This copies the class onto a new page. Pick a new connection for each device, or one that already
								exists. Pages you already created are left as they are.
							</p>
							<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
								<FormLabel htmlFor={pageNameId} sm={4} column="sm">
									Page name
								</FormLabel>
								<Grid.Col sm={8}>
									<TextInputField id={pageNameId} value={pageName} setValue={setPageName} immediateValue />
								</Grid.Col>
							</Form>
							{pageClass?.slots.map((slot) => {
								const draft = drafts[slot.connectionId]
								if (!draft) return null
								const sameModule = connections.getAllOfModuleId(slot.moduleId)
								return (
									<div key={slot.connectionId} className="page-class-slot">
										<p className="font-bold">
											{slot.label} <span className="page-class-meta">{slot.moduleId}</span>
										</p>
										<SimpleDropdownInputField
											id={undefined}
											value={draft.mode}
											setValue={(value) =>
												setDraft(slot.connectionId, { mode: value === 'existing' ? 'existing' : 'clone' })
											}
											choices={[
												{ id: 'clone', label: 'Create a new connection' },
												{ id: 'existing', label: 'Use an existing connection' },
											]}
										/>
										{draft.mode === 'clone' ? (
											<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
												<FormLabel htmlFor={undefined} sm={4} column="sm">
													Label
												</FormLabel>
												<Grid.Col sm={8}>
													<TextInputField
														id={undefined}
														value={draft.label}
														setValue={(label) => setDraft(slot.connectionId, { label })}
														immediateValue
													/>
													<div className="page-class-meta">Letters, numbers, _ and - only.</div>
												</Grid.Col>
												<FormLabel htmlFor={undefined} sm={4} column="sm">
													Address
												</FormLabel>
												<Grid.Col sm={8}>
													<TextInputField
														id={undefined}
														value={draft.host}
														setValue={(host) => setDraft(slot.connectionId, { host })}
														placeholder="Leave blank to copy the saved address"
														immediateValue
													/>
												</Grid.Col>
											</Form>
										) : sameModule.length === 0 ? (
											<p>There is no connection of this module yet. Create a new one instead.</p>
										) : (
											<SimpleDropdownInputField
												id={undefined}
												value={draft.existingConnectionId}
												setValue={(value) => setDraft(slot.connectionId, { existingConnectionId: String(value) })}
												choices={sameModule.map((connection) => ({ id: connection.id, label: connection.label }))}
											/>
										)}
									</div>
								)
							})}
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy} onClick={create}>
								Create page
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

function UpdatePageClassModal({
	pageClass,
	onClose,
}: {
	pageClass: PageClassSummary | null
	onClose: () => void
}): React.JSX.Element {
	const { notifier, pages } = useContext(RootAppStoreContext)
	const [pageNumber, setPageNumber] = useState('1')
	const [busy, setBusy] = useState(false)
	const updateMutation = useMutationExt(trpc.pageClasses.updateFromPage.mutationOptions())

	useEffect(() => {
		if (pageClass) setPageNumber('1')
	}, [pageClass])

	const replace = () => {
		if (!pageClass) return
		setBusy(true)
		updateMutation
			.mutateAsync({ classId: pageClass.id, pageNumber: Number(pageNumber) })
			.then(() => {
				refreshPageClasses()
				onClose()
				notifier.show('Page class', `Updated ${pageClass.name}`, 3000)
			})
			.catch((e) => {
				notifier.show('Page class', errorText(e))
			})
			.finally(() => setBusy(false))
	}

	const choices = pages.data.map((info, index) => ({
		id: String(index + 1),
		label: info.name ? `${index + 1} (${info.name})` : `Page ${index + 1}`,
	}))

	return (
		<Modal.Root open={!!pageClass} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Update {pageClass?.name}</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								Replace this class with the buttons on the page you pick. Pages you already created from the class are
								not changed.
							</p>
							<SimpleDropdownInputField
								id={undefined}
								value={pageNumber}
								setValue={(value) => setPageNumber(String(value))}
								choices={choices}
							/>
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy} onClick={replace}>
								Replace class
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
