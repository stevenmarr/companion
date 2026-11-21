/** PV fork: pages Control Center outputs for Companion (GET /api/companion/catalog on Control Center 0.33.0+) */

export interface ControlCenterPagesCatalogPage {
	id: string
	title: string
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
