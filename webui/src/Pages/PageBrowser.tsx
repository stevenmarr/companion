import { faCopy, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { PageClassSlot, PageClassSummary } from '@companion-app/shared/Model/PageClassModel.js'
import type { PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'
import { suggestNextLabel } from '@companion-app/shared/PageClass.js'
import { getPageSurfaceLayout, type PageSurfaceCellKind } from '@companion-app/shared/PageSurfaceLayout.js'
import { rememberViewedPage } from '~/Buttons/GridPageNavigation.js'
import { InstantiatePageClassModal } from '~/Buttons/PageClasses.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './PageBrowser.css'

const SNAPSHOT_SIZE: PreviewRenderSize = { width: 36, height: 36 }

interface SnapshotCell {
	row: number
	column: number
	kind: PageSurfaceCellKind
	occupied: boolean
}

interface SlotDraft {
	mode: 'clone' | 'existing'
	existingConnectionId: string
	label: string
	host: string
}

function cellsForPage(page: PagesStoreModel): SnapshotCell[] {
	const layout = getPageSurfaceLayout(page.surfaceLayout)
	if (layout) {
		return layout.cells.map((cell) => ({
			row: cell.row,
			column: cell.column,
			kind: cell.kind,
			occupied: Boolean(page.controls.get(cell.row)?.get(cell.column)),
		}))
	}

	let minRow = Infinity
	let maxRow = -Infinity
	let minColumn = Infinity
	let maxColumn = -Infinity
	let any = false
	for (const [row, columns] of page.controls.entries()) {
		for (const [column, controlId] of columns.entries()) {
			if (!controlId) continue
			any = true
			minRow = Math.min(minRow, row)
			maxRow = Math.max(maxRow, row)
			minColumn = Math.min(minColumn, column)
			maxColumn = Math.max(maxColumn, column)
		}
	}
	if (!any) return []

	const cells: SnapshotCell[] = []
	for (let row = minRow; row <= maxRow; row++) {
		for (let column = minColumn; column <= maxColumn; column++) {
			cells.push({
				row,
				column,
				kind: 'button',
				occupied: Boolean(page.controls.get(row)?.get(column)),
			})
		}
	}
	return cells
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export const PageBrowser = observer(function PageBrowser(): React.JSX.Element {
	const { notifier, pages } = useContext(RootAppStoreContext)
	const navigate = useNavigate()
	const deleteRef = useRef<GenericConfirmModalRef>(null)
	const [duplicatePage, setDuplicatePage] = useState<number | null>(null)
	const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
	const [template, setTemplate] = useState<PageClassSummary | null>(null)
	const insertMutation = useMutationExt(trpc.pages.insert.mutationOptions())
	const removeMutation = useMutationExt(trpc.pages.remove.mutationOptions())

	const openPage = (pageNumber: number) => {
		rememberViewedPage(pageNumber)
		void navigate({ to: `/buttons/${pageNumber}` })
	}

	const createBlank = () => {
		const pageNumber = pages.pageCount + 1
		insertMutation
			.mutateAsync({ asPageNumber: pageNumber, pageNames: [''] })
			.then(() => openPage(pageNumber))
			.catch((e) => notifier.show('Pages', errorText(e)))
	}

	const askDelete = (pageNumber: number, name: string) => {
		deleteRef.current?.show(
			'Delete page?',
			[
				`Are you sure you want to delete page ${pageNumber}${name ? `, "${name}"` : ''}?`,
				'This deletes every button on that page, and the pages after it move up a number.',
			],
			'Delete',
			() => {
				removeMutation.mutateAsync({ pageNumber }).catch((e) => notifier.show('Pages', errorText(e)))
			}
		)
	}

	return (
		<div className="page-browser">
			<div className="page-browser-heading">
				<div>
					<h4>Pages</h4>
					<p>
						A picture of each page. Choose one to edit it. Duplicate copies the buttons and lets you point them at
						different connections.
					</p>
				</div>
				<div className="page-browser-create">
					<Button color="primary" onClick={createBlank}>
						<FontAwesomeIcon icon={faPlus} /> New page
					</Button>
					<Button color="secondary" onClick={() => setTemplatePickerOpen(true)}>
						<FontAwesomeIcon icon={faCopy} /> From template
					</Button>
				</div>
			</div>

			<GenericConfirmModal ref={deleteRef} />
			<DuplicatePageModal pageNumber={duplicatePage} onClose={() => setDuplicatePage(null)} onCreated={openPage} />
			<TemplatePickerModal
				open={templatePickerOpen}
				onOpenChange={setTemplatePickerOpen}
				onPick={(pageClass) => {
					setTemplatePickerOpen(false)
					setTemplate(pageClass)
				}}
			/>
			<InstantiatePageClassModal pageClass={template} onClose={() => setTemplate(null)} onCreated={openPage} />

			{pages.pageCount === 0 ? (
				<p>No pages yet.</p>
			) : (
				<div className="page-browser-cards">
					{pages.data.map((page, index) => (
						<PageCard
							key={page.id}
							pageNumber={index + 1}
							page={page}
							canDelete={pages.pageCount > 1}
							onOpen={openPage}
							onDuplicate={setDuplicatePage}
							onDelete={askDelete}
						/>
					))}
				</div>
			)}
		</div>
	)
})

const PageCard = observer(function PageCard({
	pageNumber,
	page,
	canDelete,
	onOpen,
	onDuplicate,
	onDelete,
}: {
	pageNumber: number
	page: PagesStoreModel
	canDelete: boolean
	onOpen: (pageNumber: number) => void
	onDuplicate: (pageNumber: number) => void
	onDelete: (pageNumber: number, name: string) => void
}): React.JSX.Element {
	const cells = cellsForPage(page)
	const layout = getPageSurfaceLayout(page.surfaceLayout)
	const bounds = cells.reduce(
		(box, cell) => ({
			minRow: Math.min(box.minRow, cell.row),
			maxRow: Math.max(box.maxRow, cell.row),
			minColumn: Math.min(box.minColumn, cell.column),
			maxColumn: Math.max(box.maxColumn, cell.column),
		}),
		{ minRow: Infinity, maxRow: -Infinity, minColumn: Infinity, maxColumn: -Infinity }
	)
	const columns = cells.length === 0 ? 0 : bounds.maxColumn - bounds.minColumn + 1
	const rows = cells.length === 0 ? 0 : bounds.maxRow - bounds.minRow + 1
	const title = page.name?.trim() ? page.name : `Page ${pageNumber}`

	return (
		<article className="page-browser-card">
			<button type="button" className="page-browser-open" onClick={() => onOpen(pageNumber)}>
				<div className="page-browser-card-heading">
					<span className="page-browser-number">{pageNumber}</span>
					<span className="page-browser-title">{title}</span>
				</div>
				<div className="page-browser-surface">{layout ? `${layout.label} · ${layout.summary}` : 'Full grid'}</div>
				{cells.length === 0 ? (
					<div className="page-browser-empty">Empty page</div>
				) : (
					<div
						className="page-browser-snapshot"
						style={{
							gridTemplateColumns: `repeat(${columns}, minmax(0, 22px))`,
							gridTemplateRows: `repeat(${rows}, 22px)`,
						}}
					>
						{cells.map((cell) => (
							<PageSnapshotCell
								key={`${cell.row}/${cell.column}`}
								pageNumber={pageNumber}
								cell={cell}
								minRow={bounds.minRow}
								minColumn={bounds.minColumn}
							/>
						))}
					</div>
				)}
			</button>
			<div className="page-browser-actions">
				<Button color="secondary" size="sm" onClick={() => onOpen(pageNumber)}>
					Open
				</Button>
				<Button
					color="primary"
					size="sm"
					onClick={() => onDuplicate(pageNumber)}
					title="Duplicate, and choose connections"
				>
					<FontAwesomeIcon icon={faCopy} /> Duplicate
				</Button>
				<Button
					color="warning"
					size="sm"
					disabled={!canDelete}
					title={canDelete ? 'Delete page' : 'Companion needs at least one page'}
					onClick={() => onDelete(pageNumber, page.name?.trim() ?? '')}
				>
					<FontAwesomeIcon icon={faTrash} /> Delete
				</Button>
			</div>
		</article>
	)
})

function PageSnapshotCell({
	pageNumber,
	cell,
	minRow,
	minColumn,
}: {
	pageNumber: number
	cell: SnapshotCell
	minRow: number
	minColumn: number
}): React.JSX.Element {
	const location: ControlLocation = { pageNumber, row: cell.row, column: cell.column }
	const image = useButtonImageForLocation(location, SNAPSHOT_SIZE, !cell.occupied)
	const tag = cell.kind === 'encoder' ? 'Knob' : cell.kind === 'touch' ? 'Touch' : cell.kind === 'tbar' ? 'T-bar' : ''

	return (
		<div
			className="page-browser-cell"
			data-kind={cell.kind}
			title={tag || undefined}
			style={{
				gridColumn: cell.column - minColumn + 1,
				gridRow: cell.row - minRow + 1,
			}}
		>
			{image.image ? <img src={image.image} alt="" /> : null}
		</div>
	)
}

const DuplicatePageModal = observer(function DuplicatePageModal({
	pageNumber,
	onClose,
	onCreated,
}: {
	pageNumber: number | null
	onClose: () => void
	onCreated: (pageNumber: number) => void
}): React.JSX.Element {
	const { connections, notifier, pages } = useContext(RootAppStoreContext)
	const [pageName, setPageName] = useState('')
	const [drafts, setDrafts] = useState<Record<string, SlotDraft>>({})
	const [busy, setBusy] = useState(false)
	const pageNameId = useId()
	const duplicateMutation = useMutationExt(trpc.pageClasses.duplicateFromPage.mutationOptions())
	const described = useQuery({
		...trpc.pageClasses.describePage.queryOptions({ pageNumber: pageNumber ?? 1 }),
		enabled: pageNumber != null,
	})

	useEffect(() => {
		if (pageNumber == null || !described.data) return
		const taken = new Set<string>()
		for (const connection of connections.connections.values()) taken.add(connection.label)

		const next: Record<string, SlotDraft> = {}
		for (const slot of described.data.slots) {
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
		const currentName = pages.get(pageNumber)?.name?.trim() || described.data.sourcePageName
		setPageName(currentName ? `${currentName} copy` : '')
	}, [pageNumber, described.data, connections, pages])

	const setDraft = (connectionId: string, patch: Partial<SlotDraft>) => {
		setDrafts((current) => ({ ...current, [connectionId]: { ...current[connectionId], ...patch } }))
	}

	const duplicate = () => {
		if (pageNumber == null || !described.data) return
		setBusy(true)
		duplicateMutation
			.mutateAsync({
				pageNumber,
				pageName,
				bindings: described.data.slots.map((slot) => {
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
				notifier.show('Pages', `Duplicated as page ${result.pageNumber}`, 3000)
			})
			.catch((e) => notifier.show('Pages', errorText(e)))
			.finally(() => setBusy(false))
	}

	const slots = described.data?.slots ?? []

	return (
		<Modal.Root open={pageNumber != null} onOpenChange={(open) => !open && onClose()}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>Duplicate page {pageNumber}</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>
								This copies the page. Each connection can be a new one, or one that already exists. The page you copied
								is left as it is.
							</p>
							{described.isPending && <p>Reading the page...</p>}
							{described.error && <p>Couldn't read that page.</p>}
							<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
								<FormLabel htmlFor={pageNameId} sm={4} column="sm">
									Page name
								</FormLabel>
								<Grid.Col sm={8}>
									<TextInputField id={pageNameId} value={pageName} setValue={setPageName} immediateValue />
								</Grid.Col>
							</Form>
							{slots.length === 0 && described.data && <p>This page does not use a connection.</p>}
							{slots.map((slot) => (
								<ConnectionSlotFields
									key={slot.connectionId}
									slot={slot}
									draft={drafts[slot.connectionId]}
									onChange={(patch) => setDraft(slot.connectionId, patch)}
								/>
							))}
						</Modal.Body>
						<Modal.Footer>
							<Button color="primary" disabled={busy || !described.data} onClick={duplicate}>
								Duplicate page
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

const ConnectionSlotFields = observer(function ConnectionSlotFields({
	slot,
	draft,
	onChange,
}: {
	slot: PageClassSlot
	draft: SlotDraft | undefined
	onChange: (patch: Partial<SlotDraft>) => void
}): React.JSX.Element | null {
	const { connections } = useContext(RootAppStoreContext)
	if (!draft) return null
	const sameModule = connections.getAllOfModuleId(slot.moduleId)

	return (
		<div className="page-class-slot">
			<p className="font-bold">
				{slot.label} <span className="page-class-meta">{slot.moduleId}</span>
			</p>
			<SimpleDropdownInputField
				id={undefined}
				value={draft.mode}
				setValue={(value) => onChange({ mode: value === 'existing' ? 'existing' : 'clone' })}
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
							setValue={(label) => onChange({ label })}
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
							setValue={(host) => onChange({ host })}
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
					setValue={(value) => onChange({ existingConnectionId: String(value) })}
					choices={sameModule.map((connection) => ({ id: connection.id, label: connection.label }))}
				/>
			)}
		</div>
	)
})

function TemplatePickerModal({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	onPick: (pageClass: PageClassSummary) => void
}): React.JSX.Element {
	const templates = useQuery(trpc.pageClasses.list.queryOptions())
	const classes = templates.data ?? []

	return (
		<Modal.Root open={open} onOpenChange={onOpenChange}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>New page from a template</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p>Pick a template. You then choose the connections for the new page.</p>
							{templates.isPending && <p>Loading templates...</p>}
							{templates.error && <p>Couldn't load templates.</p>}
							{!templates.isPending && classes.length === 0 && (
								<p>No templates yet. Open a page, then use its menu and choose Save page as template.</p>
							)}
							<div className="page-browser-templates">
								{classes.map((pageClass) => (
									<button
										key={pageClass.id}
										type="button"
										className="page-browser-template"
										onClick={() => onPick(pageClass)}
									>
										<span className="page-browser-title">{pageClass.name}</span>
										<span className="page-browser-surface">
											Saved from {pageClass.sourcePageName}
											{pageClass.slots.length > 0 ? ` · ${pageClass.slots.map((slot) => slot.label).join(', ')}` : ''}
										</span>
									</button>
								))}
							</div>
						</Modal.Body>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
