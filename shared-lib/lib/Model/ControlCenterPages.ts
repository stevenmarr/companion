/** PV fork: pages Control Center outputs for Companion (GET /api/companion/catalog on Control Center 0.33.0+) */

export interface ControlCenterPagesCatalogPage {
	id: string
	title: string
	/** Control Center 0.36.0: the whole-deck entry (follows Control Center's HOME and page keys) */
	whole?: boolean
	/** Control Center 0.36.0: the system a deck page drives, and that system's name ("PTZ 2") */
	system?: string
	instance?: string
}

export interface ControlCenterUserPage {
	id: string
	name: string
	origin: string
	originTitle: string
	surfaceLayout: string
	controls: number
	connections: { label: string; moduleId: string }[]
	createdAt: number
	updatedAt: number
}

export interface ControlCenterPagesCatalog {
	appVersion: string
	connection: string
	moduleId: string
	deck: { surface: string; label: string; layout: string; pages: ControlCenterPagesCatalogPage[] }[]
	library: { id: string; title: string; surface: string; label: string; layout: string }[]
	user: (ControlCenterUserPage & { userId: string; title: string })[]
}

export interface ControlCenterPagesState {
	connection: { id: string; label: string; url: string } | null
	catalog: ControlCenterPagesCatalog | null
	error: string | null
}
