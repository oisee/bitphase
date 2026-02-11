<script lang="ts">
	import { themeStore } from '../../stores/theme.svelte';
	import { themeService } from '../../services/theme/theme-service';
	import { themeEditorStore } from '../../stores/theme-editor.svelte';
	import { open } from '../../services/modal/modal-service';
	import SettingsModal from '../Settings/SettingsModal.svelte';
	import ThemeListItem from '../Theme/ThemeListItem.svelte';
	import Button from '../Button/Button.svelte';
	import IconCarbonAdd from '~icons/carbon/add';
	import IconCarbonDocumentImport from '~icons/carbon/document-import';
	import { downloadJson, pickFileAsText } from '../../utils/file-download';
	import { appearanceSettings } from '../../config/settings';
	import type { Settings } from './types';
	import SettingField from './SettingField.svelte';

	let { onCloseSettings, tempSettings = $bindable() } = $props<{
		onCloseSettings?: () => void;
		tempSettings: Settings;
	}>();

	const allThemes = $derived(themeStore.getAllThemes());
	const activeThemeId = $derived(themeStore.activeThemeId);
	const customThemes = $derived(themeStore.getCustomThemes());

	const groupedSettings = $derived.by(() => {
		const patternEditorFontFamily = appearanceSettings.find(
			(item) => item.setting === 'patternEditorFontFamily'
		);
		const patternEditorFontSize = appearanceSettings.find(
			(item) => item.setting === 'patternEditorFontSize'
		);

		const groups: Array<{
			family: typeof patternEditorFontFamily;
			size: typeof patternEditorFontSize;
		}> = [];

		if (patternEditorFontFamily && patternEditorFontSize) {
			groups.push({ family: patternEditorFontFamily, size: patternEditorFontSize });
		}

		const otherSettings = appearanceSettings.filter(
			(item) =>
				item.setting !== 'patternEditorFontFamily' &&
				item.setting !== 'patternEditorFontSize'
		);

		return { groups, otherSettings };
	});

	let isReopening = $state(false);

	const reopenSettings = async () => {
		if (isReopening) return;
		isReopening = true;
		try {
			await open(SettingsModal, { initialTabId: 'appearance' });
		} finally {
			isReopening = false;
		}
	};

	function handleThemeSelect(themeId: string) {
		themeStore.setActiveTheme(themeId);
		const theme = themeStore.getActiveTheme();
		if (theme) {
			themeService.applyTheme(theme);
		}
	}

	function handleCreateTheme() {
		const defaultTheme = themeStore.getActiveTheme();
		if (!defaultTheme) return;

		const newTheme = {
			...defaultTheme,
			id: `custom-${Date.now()}`,
			name: `Custom Theme ${customThemes.length + 1}`,
			isCustom: true
		};

		onCloseSettings?.();
		themeEditorStore.setEditingTheme(newTheme, true, reopenSettings);
	}

	function handleEditTheme(theme: (typeof allThemes)[0]) {
		onCloseSettings?.();
		if (theme.isCustom) {
			themeEditorStore.setEditingTheme({ ...theme }, false, reopenSettings);
		} else {
			const newTheme = {
				...theme,
				id: `custom-${Date.now()}`,
				name: `${theme.name} (Copy)`,
				isCustom: true
			};
			themeEditorStore.setEditingTheme(newTheme, true, reopenSettings);
		}
	}

	function handleDeleteTheme(themeId: string) {
		themeStore.deleteCustomTheme(themeId);
		const activeTheme = themeStore.getActiveTheme();
		if (activeTheme) {
			themeService.applyTheme(activeTheme);
		}
	}

	function handleExportTheme(themeId: string) {
		const exportData = themeStore.exportTheme(themeId);
		if (!exportData) return;

		const theme = themeStore.getAllThemes().find((t) => t.id === themeId);
		if (!theme) return;

		const filename = `${theme.name.replace(/\s+/g, '-').toLowerCase()}.json`;
		downloadJson(filename, JSON.parse(exportData));
	}

	async function handleImportTheme() {
		try {
			const text = await pickFileAsText();
			const theme = themeStore.importTheme(text);
			if (!theme) {
				alert('Failed to import theme. Invalid format.');
				return;
			}
			themeStore.addCustomTheme(theme);
			handleThemeSelect(theme.id);
		} catch (err) {
			if ((err as Error).message !== 'No file selected') {
				alert('Failed to import theme: ' + (err as Error).message);
			}
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#if appearanceSettings.length > 0}
		<div class="flex flex-col gap-4">
			{#each groupedSettings.groups as group (group.family?.setting ?? '')}
				{#if group.family && group.size}
					<div class="flex items-end gap-4">
						<div class="flex-1">
							<SettingField item={group.family} bind:tempSettings />
						</div>
						<div class="flex-1">
							<SettingField item={group.size} bind:tempSettings />
						</div>
					</div>
				{/if}
			{/each}
			{#each groupedSettings.otherSettings as item (item.setting)}
				<SettingField {item} bind:tempSettings />
			{/each}
		</div>
	{/if}

	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--color-app-text-primary)]">Themes</h3>
		<div class="flex gap-2">
			<Button variant="secondary" onclick={handleImportTheme}>
				{#snippet children()}
					<div class="flex items-center gap-2">
						<IconCarbonDocumentImport class="h-4 w-4" />
						<span>Import</span>
					</div>
				{/snippet}
			</Button>
			<Button variant="primary" onclick={handleCreateTheme}>
				{#snippet children()}
					<div class="flex items-center gap-2">
						<IconCarbonAdd class="h-4 w-4" />
						<span>Create Theme</span>
					</div>
				{/snippet}
			</Button>
		</div>
	</div>

	<div class="flex flex-col gap-1.5">
		{#each allThemes as theme (theme.id)}
			<ThemeListItem
				{theme}
				isActive={theme.id === activeThemeId}
				onSelect={() => handleThemeSelect(theme.id)}
				onEdit={() => handleEditTheme(theme)}
				onDelete={theme.isCustom ? () => handleDeleteTheme(theme.id) : undefined}
				onExport={() => handleExportTheme(theme.id)} />
		{/each}
	</div>
</div>
