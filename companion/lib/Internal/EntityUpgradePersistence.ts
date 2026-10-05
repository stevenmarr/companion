/**
 * Control ids whose internal entities were rewritten while loading.
 * The control is not in the store yet when the entity is constructed, so the
 * upgrade cannot commit itself. {@link consumeUpgradedControlIds} is drained
 * once controls have been registered.
 */
const upgradedControlIds = new Set<string>()

export function noteUpgradedControl(controlId: string): void {
	if (controlId) upgradedControlIds.add(controlId)
}

export function consumeUpgradedControlIds(): string[] {
	const ids = Array.from(upgradedControlIds)
	upgradedControlIds.clear()
	return ids
}
