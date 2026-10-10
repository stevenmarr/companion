import { useDragDropMonitor } from '@dnd-kit/react'
import './Pages.css'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faPencil, faPlus, faShareFromSquare, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { getPageSurfaceLayout } from '@companion-app/shared/PageSurfaceLayout.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { EditPagePropertiesModal, type EditPagePropertiesModalRef } from './EditPageProperties.js'
import { PageClassesSection } from './PageClasses.js'

interface PagesListProps {
	pageNumber: number
	setPageNumber: (page: number) => void
}

export const PagesList = observer(function PagesList({ pageNumber, setPageNumber }: PagesListProps): React.JSX.Element {
	const { pages } = useContext(RootAppStoreContext)

	const deleteRef = useRef<GenericConfirmModalRef>(null)
	const editRef = useRef<EditPagePropertiesModalRef>(null)
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())

	const selected = pages.data.flatMap((info, index) =>
		selectedIds.has(info.id) ? [{ id: info.id, pageNumber: index + 1, name: info.name ?? '' }] : []
	)
	const allSelected = pages.data.length > 0 && selected.length === pages.data.length
	const canDeleteSelected = selected.length > 0 && selected.length < pages.data.length

	const toggleSelected = useCallback((pageId: string, selected: boolean) => {
		setSelectedIds((current) => {
			const next = new Set(current)
			if (selected) next.add(pageId)
			else next.delete(pageId)
			return next
		})
	}, [])

	const toggleAll = useCallback(
		(selected: boolean) => {
			setSelectedIds(selected ? new Set(pages.data.map((info) => info.id)) : new Set())
		},
		[pages]
	)

	const goToPage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			if (!isNaN(pageNumber)) {
				setPageNumber(pageNumber)
			}
		},
		[setPageNumber]
	)

	const configurePage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const nextPageNumber = Number(e.currentTarget.getAttribute('data-page'))
			if (isNaN(nextPageNumber)) return
			editRef.current?.show(nextPageNumber, pages.get(nextPageNumber))
		},
		[pages]
	)

	const insertMutation = useMutationExt(trpc.pages.insert.mutationOptions())
	const doInsertPage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			if (!isNaN(pageNumber)) {
				// addRef.current?.show?.(pageNumber)
				insertMutation
					.mutateAsync({
						asPageNumber: pageNumber,
						pageNames: [''],
					})
					.catch((e) => {
						console.error('Page insert failed', e)
					})
			}
		},
		[insertMutation]
	)

	const removeMutation = useMutationExt(trpc.pages.remove.mutationOptions())
	const doDeletePage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			const pageName = e.currentTarget.getAttribute('data-name') ?? ''

			if (isNaN(pageNumber)) return

			deleteRef.current?.show(
				'Delete page?',
				[
					`Are you sure you want to delete Page ${pageNumber}${pageName && pageName !== 'PAGE' ? ', "' + pageName + '"' : ''}?`,
					'This will delete all controls on the page, and will adjust the page numbers of all following pages',
				],
				'Delete',
				() => {
					removeMutation.mutateAsync({ pageNumber }).catch((e) => {
						console.error('Page delete failed', e)
					})
				}
			)
		},
		[removeMutation]
	)

	const removeManyMutation = useMutationExt(trpc.pages.removeMany.mutationOptions())
	const doDeleteSelected = useCallback(() => {
		if (!canDeleteSelected) return

		const labels = selected.map((page) =>
			page.name && page.name !== 'PAGE' ? `page ${page.pageNumber} ("${page.name}")` : `page ${page.pageNumber}`
		)
		const list =
			labels.length === 1
				? labels[0]
				: labels.length === 2
					? `${labels[0]} and ${labels[1]}`
					: `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`

		deleteRef.current?.show(
			`Delete ${selected.length} pages?`,
			[
				`Are you sure you want to delete ${list}?`,
				'This will delete all controls on those pages, and will adjust the page numbers of the pages that remain',
			],
			'Delete',
			() => {
				removeManyMutation
					.mutateAsync({ pageNumbers: selected.map((page) => page.pageNumber) })
					.then(() => setSelectedIds(new Set()))
					.catch((e) => {
						console.error('Page delete failed', e)
					})
			}
		)
	}, [canDeleteSelected, removeManyMutation, selected])

	// Reordering is handled here (the dnd-kit provider is global); we filter to page-list drags.
	// For sortables the new position is the source's projected index (1-based page number).
	const moveMutation = useMutationExt(trpc.pages.move.mutationOptions())
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== 'page-list' || !isSortable(source)) return
			const { initialIndex, index } = source
			if (initialIndex === index) return
			moveMutation.mutateAsync({ pageId: String(source.id), pageNumber: index + 1 }).catch((e) => {
				console.error('Page move failed', e)
			})
		},
	})

	return (
		<div>
			<h5>Pages</h5>
			<p>
				Tick pages and delete them together, or use the trash icon for one page. You can also insert pages and drag them
				into a new order. The pencil sets the surface the page is written for, and an image buttons can show with the
				feedback "Page: Show page image". The Pages item on the left shows a picture of every page.
			</p>
			<Grid.Row>
				<Grid.Col xs={12}>
					<GenericConfirmModal ref={deleteRef} />
					<EditPagePropertiesModal ref={editRef} includeName={false} />

					<div className="collections-nesting-table pages-list-table">
						<div className="collections-nesting-table-row-item">
							<div className="collections-nesting-table-row-item-grid font-bold">
								<div className="row-reorder-handle invisible">
									<FontAwesomeIcon icon={faSort} />
								</div>
								<div className="grow flex items-center gap-2">
									<div className="pages-list-check">
										<CheckboxInputField
											id="pages-select-all"
											value={allSelected}
											indeterminate={selected.length > 0 && !allSelected}
											setValue={toggleAll}
											disabled={pages.data.length <= 1}
											tooltip="Select pages"
										/>
									</div>
									<div className="pages-list-number">Number</div>
									<div className="grow">Name</div>
									<div className="ms-auto">
										<ButtonGroup className="pages-list-actions">
											{selected.length > 0 && (
												<Button
													color="primary"
													size="sm"
													onClick={doDeleteSelected}
													disabled={!canDeleteSelected}
													title={
														canDeleteSelected ? `Delete ${selected.length} pages` : 'Companion needs at least one page'
													}
												>
													<FontAwesomeIcon icon={faTrash} />
												</Button>
											)}
											<Button
												color="warning"
												size="sm"
												onClick={doInsertPage}
												title="Insert page at start"
												data-page={1}
											>
												<FontAwesomeIcon icon={faPlus} />
											</Button>
										</ButtonGroup>
									</div>
								</div>
							</div>
						</div>
						{pages.data.map((info, id) => (
							<PageListRow
								key={info.id}
								index={id}
								pageNumber={id + 1}
								info={info}
								pageCount={pages.data.length}
								goToPage={goToPage}
								configurePage={configurePage}
								doInsertPage={doInsertPage}
								doDeletePage={doDeletePage}
								selected={selectedIds.has(info.id)}
								toggleSelected={toggleSelected}
							/>
						))}
					</div>
					<PageClassesSection pageNumber={pageNumber} setPageNumber={setPageNumber} />
				</Grid.Col>
			</Grid.Row>
		</div>
	)
})

interface PageListRowProps {
	index: number
	pageNumber: number
	info: PagesStoreModel
	pageCount: number
	goToPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	configurePage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
	selected: boolean
	toggleSelected: (pageId: string, selected: boolean) => void
}

const PageListRow = observer(function PageListRow({
	index,
	pageNumber,
	info,
	pageCount,
	goToPage,
	configurePage,
	doInsertPage,
	doDeletePage,
	selected,
	toggleSelected,
}: PageListRowProps) {
	const setNameMutation = useMutationExt(trpc.pages.setName.mutationOptions())

	const changeName = useCallback(
		(newName: string) => {
			setNameMutation
				.mutateAsync({
					pageNumber,
					name: newName ?? '',
				})
				.catch((e) => {
					console.error('Failed to set name', e)
				})
		},
		[setNameMutation, pageNumber]
	)

	const { ref, handleRef } = useSortable({ id: info.id, index, type: 'page-list', accept: 'page-list' })

	return (
		<div ref={ref} className="collections-nesting-table-row-item">
			<div className="collections-nesting-table-row-item-grid">
				<div ref={handleRef} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
				</div>
				<div className="grow flex items-center gap-2">
					<div className="pages-list-check">
						<CheckboxInputField
							id={`page-select-${info.id}`}
							value={selected}
							setValue={(on) => toggleSelected(info.id, on)}
							disabled={pageCount <= 1}
							tooltip="Select page"
						/>
					</div>
					<div className="pages-list-number font-bold">{pageNumber}</div>
					<div className="grow">
						<TextInputFieldSimple
							id={undefined}
							value={info.name ?? ''}
							setValue={changeName}
							placeholder="Unnamed page"
						/>
						{info.surfaceLayout && (
							<div className="page-class-meta">{getPageSurfaceLayout(info.surfaceLayout)?.label}</div>
						)}
					</div>
					<Button color="light" size="sm" onClick={configurePage} title="Surface and image" data-page={pageNumber}>
						<FontAwesomeIcon icon={faPencil} />
					</Button>
					<ButtonGroup className="pages-list-actions ms-auto">
						<Button color="secondary" size="sm" onClick={goToPage} title="Jump to page" data-page={pageNumber}>
							<FontAwesomeIcon icon={faShareFromSquare} />
						</Button>
						<Button
							color="warning"
							size="sm"
							onClick={doInsertPage}
							title="Insert page after"
							data-page={pageNumber + 1}
						>
							<FontAwesomeIcon icon={faPlus} />
						</Button>

						<Button
							color="primary"
							size="sm"
							onClick={doDeletePage}
							title="Delete page"
							data-page={pageNumber}
							data-name={info.name}
							disabled={pageCount <= 1}
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</ButtonGroup>
				</div>
			</div>
		</div>
	)
})
