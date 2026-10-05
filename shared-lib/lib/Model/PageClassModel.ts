/** A connection a page class can be pointed at when a new page is created from it. */
export interface PageClassSlot {
	/** Connection id stored inside the class snapshot. */
	connectionId: string
	label: string
	moduleId: string
}

/** A page class as shown in the UI. The button snapshot stays on the server. */
export interface PageClassSummary {
	id: string
	name: string
	/** Name of the page this class was last saved from. */
	sourcePageName: string
	updatedAt: number
	slots: PageClassSlot[]
}
