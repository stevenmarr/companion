import { faDownload, faFloppyDisk, faRotate, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ControlCenterPagesCatalogPage } from '@companion-app/shared/Model/ControlCenterPages.js'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { queryClient, trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './Pages.css'

/**
 * PV fork: "Control Center pages". Lists the pages Control Center outputs (live deck pages, PAGES library pages and
 * user pages saved back from here). "New page" makes a new Companion page that is its own copy, "On page N" lays the
 * Control Center page out on page N instead (replacing it): edit it like any page, the Control Center original never
 * changes. "Save page N to User pages" stores an edited copy in Control Center.
 *
 * Shown two ways: its own screen (left menu, BUILD → Control Center pages, `standalone`) and at the bottom of
 * Buttons → Pages tab.
 */

interface ControlCenterPagesSectionProps {
	pageNumber: number
	setPageNumber: (pageNumber: number) => void
	/** The full screen (left menu): a page picker for "On page N" and "Save page N", bigger heading */
	standalone?: boolean
	/** Called with the page number after a place */
	onPlaced?: (pageNumber: number) => void
}

function refresh(): void {
	void queryClient.invalidateQueries({ queryKey: trpc.controlCenterPages.state.queryKey() })
	void queryClient.invalidateQueries({ queryKey: trpc.controlCenterPages.originOf.queryKey() })
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export const ControlCenterPagesSection = observer(function ControlCenterPagesSection({
	pageNumber,
	setPageNumber,
	standalone,
	onPlaced,
}: ControlCenterPagesSectionProps): React.JSX.Element {
	const { notifier, pages } = useContext(RootAppStoreContext)
	const stateQuery = useQuery(trpc.controlCenterPages.state.queryOptions())
	const originQuery = useQuery(trpc.controlCenterPages.originOf.queryOptions({ pageNumber }))
	const placeMutation = useMutationExt(trpc.controlCenterPages.place.mutationOptions())
	const saveMutation = useMutationExt(trpc.controlCenterPages.saveUserPage.mutationOptions())
	const removeMutation = useMutationExt(trpc.controlCenterPages.removeUserPage.mutationOptions())
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const state = stateQuery.data
	const catalog = state?.catalog ?? null
	const origin = originQuery.data ?? null
	const currentPageName = pages.get(pageNumber)?.name ?? ''

	const [saveName, setSaveName] = useState(currentPageName)
	const [busy, setBusy] = useState(false)
	useEffect(
		() => setSaveName(origin?.title ? `${currentPageName || origin.title}` : currentPageName),
		[currentPageName, origin?.title]
	)

	const doPlace = useCallback(
		(page: ControlCenterPagesCatalogPage, targetPage?: number) => {
			setBusy(true)
			placeMutation
				.mutateAsync({ id: page.id, pageName: page.title.slice(0, 60), targetPage })
				.then((res) => {
					refresh()
					notifier.show(
						'Control Center pages',
						res.replaced
							? `Laid out "${res.name}" on page ${res.pageNumber}. It is your own copy.`
							: `Placed "${res.name}" as page ${res.pageNumber}. It is your own copy.`
					)
					setPageNumber(res.pageNumber)
					onPlaced?.(res.pageNumber)
				})
				.catch((e) => notifier.show('Control Center pages', errorText(e)))
				.finally(() => setBusy(false))
		},
		[notifier, onPlaced, placeMutation, setPageNumber]
	)
	const place = useCallback((page: ControlCenterPagesCatalogPage) => doPlace(page), [doPlace])
	const placeOn = useCallback(
		(page: ControlCenterPagesCatalogPage) => {
			const name = pages.get(pageNumber)?.name
			confirmRef.current?.show(
				`Replace page ${pageNumber}?`,
				[
					`Lay out "${page.title}" on page ${pageNumber}${name ? ` (${name})` : ''}?`,
					'Every button on that page is replaced. To keep them, use New page instead.',
				],
				`Replace page ${pageNumber}`,
				() => doPlace(page, pageNumber)
			)
		},
		[doPlace, pageNumber, pages]
	)

	const save = useCallback(
		(asNew: boolean) => {
			setBusy(true)
			saveMutation
				.mutateAsync({
					pageNumber,
					name: saveName.trim() || currentPageName,
					userPageId: asNew ? undefined : (origin?.userPageId ?? undefined),
				})
				.then((res) => {
					refresh()
					notifier.show('Control Center pages', `Saved page ${pageNumber} to User pages as "${res.name}"`)
				})
				.catch((e) => notifier.show('Control Center pages', errorText(e)))
				.finally(() => setBusy(false))
		},
		[currentPageName, notifier, origin?.userPageId, pageNumber, saveMutation, saveName]
	)

	const askRemove = useCallback(
		(userPageId: string, title: string) => {
			confirmRef.current?.show(
				'Delete user page?',
				[`Delete "${title}" from User pages in Control Center?`, 'Pages you already placed from it are not deleted.'],
				'Delete',
				() => {
					removeMutation
						.mutateAsync({ userPageId })
						.then(refresh)
						.catch((e) => notifier.show('Control Center pages', errorText(e)))
				}
			)
		},
		[notifier, removeMutation]
	)

	return (
		<div className={standalone ? 'page-classes cc-pages cc-pages-standalone' : 'page-classes cc-pages'}>
			<GenericConfirmModal ref={confirmRef} />
			{standalone ? (
				<h4>
					Control Center pages{' '}
					<Button color="secondary" size="sm" onClick={refresh} title="Refresh from Control Center">
						<FontAwesomeIcon icon={faRotate} />
					</Button>
				</h4>
			) : (
				<h5>
					Control Center pages{' '}
					<Button color="secondary" size="sm" onClick={refresh} title="Refresh from Control Center">
						<FontAwesomeIcon icon={faRotate} />
					</Button>
				</h5>
			)}
			<p>
				Pages straight from Control Center, laid out key for key like Control Center (strip and knobs included).{' '}
				<b>New page</b> adds your own copy as a new page; <b>On page {pageNumber}</b> lays it out on page {pageNumber}{' '}
				instead, replacing what is there. Edit the copy like any page, the Control Center original never changes. Then
				show it on a deck from that deck&apos;s page buttons, or save your edited copy to User pages.
				{state?.connection && (
					<>
						{' '}
						Using connection <b>{state.connection.label}</b> ({state.connection.url}).
					</>
				)}
			</p>

			{standalone && (
				<div className="cc-pages-target flex items-center gap-2">
					<label htmlFor="cc-pages-target-page">Page for &quot;On page N&quot; and &quot;Save page N&quot;:</label>
					<select
						id="cc-pages-target-page"
						className="form-select form-select-sm"
						style={{ width: 'auto' }}
						value={pageNumber}
						onChange={(e) => setPageNumber(Number(e.target.value))}
					>
						{pages.data.map((info, i) => (
							<option key={info.id} value={i + 1}>
								{i + 1}
								{info.name && info.name !== 'PAGE' ? ` · ${info.name}` : ''}
							</option>
						))}
					</select>
				</div>
			)}

			{stateQuery.isPending && <p>Loading Control Center pages...</p>}
			{state?.error && <p className="text-warning">{state.error}</p>}

			{catalog && (
				<>
					{catalog.deck.map((deck) => (
						<CcPageGroup
							key={`deck-${deck.surface}`}
							title={`Live deck pages · ${deck.label}`}
							note="The PTZ / ATEM / HOME / CONSOLE pages Control Center is driving right now."
							pages={deck.pages}
							busy={busy}
							pageNumber={pageNumber}
							onPlace={place}
							onPlaceOn={placeOn}
						/>
					))}
					<CcPageGroup
						title="Library pages"
						note="From Control Center's BUTTONS and PAGES tabs."
						pages={catalog.library}
						busy={busy}
						pageNumber={pageNumber}
						onPlace={place}
						onPlaceOn={placeOn}
						empty="No library pages in Control Center yet."
					/>
					<CcPageGroup
						title="User pages"
						note="Edited copies saved from here. Stored in Control Center (USER PAGES on its COMPANION tab)."
						pages={catalog.user}
						busy={busy}
						pageNumber={pageNumber}
						onPlace={place}
						onPlaceOn={placeOn}
						onRemove={(p) => {
							const u = catalog.user.find((x) => x.id === p.id)
							if (u) askRemove(u.userId, u.title)
						}}
						empty="No user pages yet. Place a page, edit it, then save it below."
					/>

					<div className="cc-pages-save">
						<div className="page-class-meta">
							{origin
								? `Page ${pageNumber} is a copy of "${origin.title}".`
								: `Page ${pageNumber} is not from Control Center. You can still save it to User pages.`}
						</div>
						<div className="flex items-center gap-2">
							<div className="grow">
								<TextInputFieldSimple
									id={undefined}
									value={saveName}
									setValue={setSaveName}
									placeholder="User page name"
								/>
							</div>
							<ButtonGroup>
								{origin?.userPageId ? (
									<>
										<Button color="primary" size="sm" disabled={busy} onClick={() => save(false)}>
											<FontAwesomeIcon icon={faFloppyDisk} /> Update user page
										</Button>
										<Button color="secondary" size="sm" disabled={busy} onClick={() => save(true)}>
											Save as new
										</Button>
									</>
								) : (
									<Button color="primary" size="sm" disabled={busy} onClick={() => save(true)}>
										<FontAwesomeIcon icon={faFloppyDisk} /> Save page {pageNumber} to User pages
									</Button>
								)}
							</ButtonGroup>
						</div>
					</div>
				</>
			)}
		</div>
	)
})

interface CcPageGroupProps {
	title: string
	note: string
	pages: ControlCenterPagesCatalogPage[]
	busy: boolean
	pageNumber: number
	empty?: string
	onPlace: (page: ControlCenterPagesCatalogPage) => void
	onPlaceOn: (page: ControlCenterPagesCatalogPage) => void
	onRemove?: (page: ControlCenterPagesCatalogPage) => void
}

function CcPageGroup({
	title,
	note,
	pages,
	busy,
	pageNumber,
	empty,
	onPlace,
	onPlaceOn,
	onRemove,
}: CcPageGroupProps): React.JSX.Element {
	return (
		<div className="cc-pages-group">
			<h6>{title}</h6>
			<div className="page-class-meta">{note}</div>
			{pages.length === 0 && empty && <p>{empty}</p>}
			<div className="collections-nesting-table page-class-list">
				{pages.map((page) => (
					<div className="collections-nesting-table-row-item" key={page.id}>
						<div className="collections-nesting-table-row-item-grid">
							<div className="grow flex items-center gap-2">
								<div className="grow">{page.title}</div>
								<ButtonGroup className="page-class-actions ms-auto">
									<Button
										color="primary"
										size="sm"
										disabled={busy}
										onClick={() => onPlace(page)}
										title="Copy into a new page at the end"
									>
										<FontAwesomeIcon icon={faDownload} /> New page
									</Button>
									<Button
										color="secondary"
										size="sm"
										disabled={busy}
										onClick={() => onPlaceOn(page)}
										title={`Lay it out on page ${pageNumber}, replacing that page's buttons`}
									>
										On page {pageNumber}
									</Button>
									{onRemove && (
										<Button color="warning" size="sm" onClick={() => onRemove(page)} title="Delete user page">
											<FontAwesomeIcon icon={faTrash} />
										</Button>
									)}
								</ButtonGroup>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
