import { createFileRoute } from '@tanstack/react-router'
import { ControlCenterPagesScreen } from '~/Pages/ControlCenterPagesScreen.js'

export const Route = createFileRoute('/_app/control-center-pages')({
	component: ControlCenterPagesScreen,
})
