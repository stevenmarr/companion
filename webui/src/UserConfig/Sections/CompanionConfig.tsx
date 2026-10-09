import { observer } from 'mobx-react-lite'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { formatOptions } from '~/ImportExport/ExportFormat.js'
import { TIMEZONE_CHOICES } from '~/Resources/timezones.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigDropdownRow } from '../Components/UserConfigDropdownRow.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

const APPEARANCE_CHOICES: DropdownChoice[] = [
	{ id: 'light', label: 'LCARS daylight' },
	{ id: 'dark', label: 'LCARS command' },
	{ id: 'system', label: 'Match this computer' },
]

export const CompanionConfig = observer(function CompanionConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Installation Settings" helpAction="/user-guide/config/settings#general" />
			<UserConfigDropdownRow userConfig={props} label="Appearance" field="admin_theme" choices={APPEARANCE_CHOICES} />
			<UserConfigTextInputRow userConfig={props} label="Installation Name" field="installName" />
			<UserConfigSwitchRow
				userConfig={props}
				label="Announce Companion on the network (mDNS/Bonjour)"
				field="mdns_announcements_enabled"
			/>
			<UserConfigTextInputRow
				userConfig={props}
				useVariables={true}
				label="Default Export File Name"
				field="default_export_filename"
			/>
			<UserConfigDropdownRow
				userConfig={props}
				label="Default Export Format"
				field="default_export_format"
				choices={formatOptions}
			/>
			<UserConfigDropdownRow
				userConfig={props}
				label="Timezone for time variables and triggers"
				field="timezone"
				choices={TIMEZONE_CHOICES}
				searchLabelsOnly
			/>
		</>
	)
})
