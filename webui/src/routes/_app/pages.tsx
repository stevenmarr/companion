import { createFileRoute } from '@tanstack/react-router'
import { PageBrowser } from '~/Pages/PageBrowser.js'

export const Route = createFileRoute('/_app/pages')({
	component: PageBrowser,
})
