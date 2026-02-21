import type { MenuItem } from '../components/Menu/types';
import { buildEditMenuItems } from './keybindings';
import { getDemoMenuItems } from './demo-songs';

export const editMenuItems: MenuItem[] = buildEditMenuItems();

const demoMenuItems: MenuItem[] = getDemoMenuItems();

export const menuItems: MenuItem[] = [
	{
		label: 'File',
		items: [
			{
				label: 'New',
				type: 'expandable',
				items: [
					{ label: 'Project', type: 'normal', icon: '📁', action: 'new-project' },
					{
						label: 'Song',
						type: 'expandable',
						icon: '📁',
						items: [{ label: 'AY/YM', type: 'normal', action: 'new-song-ay' }]
					}
				]
			},
			{ label: 'Open', type: 'normal', action: 'open' },
			{ label: 'Import Module', type: 'normal', action: 'import-module' },
			{ label: 'Save', type: 'normal', action: 'save' },
			{
				label: 'Export',
				type: 'expandable',
				items: [
					{ label: 'WAV', type: 'normal', action: 'export-wav' },
					{ label: 'PSG', type: 'normal', action: 'export-psg' }
				]
			}
		]
	},
	{
		label: 'Edit',
		items: editMenuItems
	},
	{
		label: 'View',
		items: [
			{
				label: 'Appearance',
				type: 'normal',
				action: 'appearance'
			}
		]
	},
	{
		label: 'Settings',
		type: 'normal',
		action: 'settings'
	},
	{
		label: 'Help',
		items: [
			{
				label: 'Demo songs',
				type: 'expandable',
				items:
				demoMenuItems.length > 0
					? demoMenuItems
					: [{ label: 'No demo songs', type: 'normal', disabled: true }]
			},
			{ label: 'Effects', type: 'normal', action: 'effects' },
			{ label: 'Documentation', type: 'normal' },
			{ label: 'About', type: 'normal', action: 'about' }
		]
	}
];
