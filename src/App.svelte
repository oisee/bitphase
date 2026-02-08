<script lang="ts">
	import MenuBar from './lib/components/Menu/MenuBar.svelte';
	import './app.css';
	import { menuItems } from './lib/config/app-menu';
	import { handleFileImport } from './lib/services/file/file-import';
	import { handleFileExport } from './lib/services/file/file-export';
	import { Project, Table } from './lib/models/project';
	import type { Song } from './lib/models/song';
	import PatternEditor from './lib/components/Song/PatternEditor.svelte';
	import ModalContainer from './lib/components/Modal/ModalContainer.svelte';
	import { open } from './lib/services/modal/modal-service';
	import { setContext } from 'svelte';
	import { AudioService } from './lib/services/audio/audio-service';
	import { ProjectService } from './lib/services/project/project-service';
	import { AY_CHIP } from './lib/chips/ay';
	import { getChipByType } from './lib/chips/registry';
	import SongView from './lib/components/Song/SongView.svelte';
	import { playbackStore } from './lib/stores/playback.svelte';
	import { settingsStore } from './lib/stores/settings.svelte';
	import { editorStateStore } from './lib/stores/editor-state.svelte';
	import { themeStore } from './lib/stores/theme.svelte';
	import { themeService } from './lib/services/theme/theme-service';
	import { themeEditorStore } from './lib/stores/theme-editor.svelte';
	import ThemeEditorModal from './lib/components/Theme/ThemeEditorModal.svelte';
	import { tick } from 'svelte';
	import { keybindingsStore } from './lib/stores/keybindings.svelte';
	import { ShortcutString } from './lib/utils/shortcut-string';
	import { ACTION_APPLY_SCRIPT } from './lib/config/keybindings';
	import { autobackupService } from './lib/services/backup/autobackup-service';
	import { runAppBootstrap } from './lib/app-bootstrap';
	import { createMenuActionHandler } from './lib/services/app/menu-action-handler';
	import type { MenuActionContext } from './lib/services/app/menu-action-context';

	runAppBootstrap();

	let lastAppliedThemeId = $state<string | null>(null);

	$effect(() => {
		if ('serviceWorker' in navigator) {
			window.addEventListener('load', () => {
				navigator.serviceWorker.register('/sw.js');
			});
		}
	});

	$effect(() => {
		const activeThemeId = themeStore.state.activeThemeId;
		if (activeThemeId === lastAppliedThemeId) return;

		const activeTheme = themeStore.getActiveTheme();
		if (activeTheme) {
			lastAppliedThemeId = activeThemeId;
			themeService.applyTheme(activeTheme);
		}
	});

	let container: { audioService: AudioService } = $state({
		audioService: new AudioService()
	});

	const projectService = new ProjectService(container.audioService);

	container.audioService.addChipProcessor(AY_CHIP);

	$effect(() => {
		const volume = settingsStore.state.volume;
		container.audioService.setVolume(volume);
	});

	$effect(() => {
		const envelopeAsNote = settingsStore.state.envelopeAsNote;
		editorStateStore.setEnvelopeAsNote(envelopeAsNote);
	});

	$effect(() => {
		const uiFontFamily = settingsStore.state.uiFontFamily;
		if (uiFontFamily) {
			document.documentElement.style.setProperty(
				'--font-sans',
				`"${uiFontFamily}", sans-serif`
			);
			document.documentElement.style.setProperty(
				'--font-mono',
				`"${uiFontFamily}", monospace`
			);
		}
	});

	let songs = $state<Song[]>([]);
	let patternOrder = $state<number[]>([]);
	let patternOrderColors = $state<Record<number, string>>({});
	let tables = $state<Table[]>([]);
	let activeSongIndex = $state(0);

	let projectSettings = $state({
		title: '',
		author: '',
		initialSpeed: 3
	});

	let projectInitialized = $state(false);

	$effect(() => {
		if (projectInitialized) return;

		(async () => {
			const newProject = await projectService.resetProject(AY_CHIP);

			projectSettings = {
				title: newProject.name,
				author: newProject.author,
				initialSpeed: newProject.songs[0]?.initialSpeed ?? 3
			};
			songs = newProject.songs;
			patternOrder = newProject.patternOrder;
			patternOrderColors = newProject.patternOrderColors ?? {};
			tables = newProject.tables;

			projectInitialized = true;

			const backup = await autobackupService.getAutobackup();
			if (backup) {
				container.audioService.clearChipProcessors();
				for (const _ of backup.songs) {
					await container.audioService.addChipProcessor(AY_CHIP);
				}
				projectSettings = {
					title: backup.name,
					author: backup.author,
					initialSpeed: backup.songs[0]?.initialSpeed ?? 3
				};
				songs = backup.songs;
				patternOrder = backup.patternOrder;
				patternOrderColors = backup.patternOrderColors ?? {};
				tables = backup.tables;
			}
		})();
	});

	function getCurrentProject(): Project {
		return new Project(
			projectSettings.title,
			projectSettings.author,
			songs,
			0,
			patternOrder,
			tables,
			patternOrderColors
		);
	}

	$effect(() => {
		if (!projectInitialized) return;
		projectSettings;
		songs;
		patternOrder;
		patternOrderColors;
		tables;
		autobackupService.saveAutobackup(getCurrentProject());
	});

	$effect(() => {
		if (!projectInitialized) return;
		function saveOnUnload() {
			autobackupService.saveAutobackup(getCurrentProject());
		}
		window.addEventListener('beforeunload', saveOnUnload);
		window.addEventListener('pagehide', saveOnUnload);
		return () => {
			window.removeEventListener('beforeunload', saveOnUnload);
			window.removeEventListener('pagehide', saveOnUnload);
		};
	});

	$effect(() => {
		container.audioService.updateTables(tables);
	});

	$effect(() => {
		if (songs.length === 0) return;

		const grouped = new Map<string, Song[]>();
		for (const song of songs) {
			if (!song.chipType) continue;
			if (!grouped.has(song.chipType)) {
				grouped.set(song.chipType, []);
			}
			grouped.get(song.chipType)!.push(song);
		}

		grouped.forEach((songsOfType, chipType) => {
			if (songsOfType.length === 0) return;

			const firstSong = songsOfType[0] as unknown as Record<string, unknown>;
			const chip = getChipByType(chipType);
			if (!chip) return;

			const settings = chip.schema.settings || [];
			settings
				.filter((s) => s.group === 'chip' && s.notifyAudioService)
				.forEach((s) => {
					const value = firstSong[s.key] ?? s.defaultValue;
					if (value !== undefined) {
						container.audioService.chipSettings.set(s.key, value);
					}
				});
		});
	});

	let patternEditor: PatternEditor | null = $state(null);

	const menuActionContext: MenuActionContext = {
		getPatternEditor: () => patternEditor,
		getCurrentProject: () =>
			new Project(
				projectSettings.title,
				projectSettings.author,
				songs,
				0,
				patternOrder,
				tables,
				patternOrderColors
			),
		applyProject: (project) => {
			projectSettings = {
				title: project.name,
				author: project.author,
				initialSpeed: project.songs[0]?.initialSpeed ?? 3
			};
			songs = project.songs;
			patternOrder = project.patternOrder;
			patternOrderColors = project.patternOrderColors ?? {};
			tables = project.tables;
		},
		removeSong: (index) => {
			songs = songs.filter((_, i) => i !== index);
			container.audioService.removeChipProcessor(index);
		},
		addSong: (song) => {
			songs = [...songs, song];
		},
		setActiveSongIndex: (index) => {
			activeSongIndex = index;
		},
		getSongsLength: () => songs.length,
		getActiveSongIndex: () => activeSongIndex,
		container,
		projectService,
		playbackStore,
		open: open as MenuActionContext['open'],
		handleFileImport,
		handleFileExport,
		clearAutobackup: () => autobackupService.clearAutobackup(),
		resetPatternEditor: () => patternEditor?.resetToBeginning?.()
	};

	const handleMenuAction = createMenuActionHandler(menuActionContext);

	setContext('container', container);

	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement;
		if (
			target?.closest?.('input, textarea') ||
			target?.getAttribute?.('contenteditable') === 'true'
		) {
			return;
		}
		const shortcut = ShortcutString.fromEvent(event);
		const action = keybindingsStore.getActionForShortcut(shortcut);
		if (action === ACTION_APPLY_SCRIPT) {
			event.preventDefault();
			handleMenuAction({ action: ACTION_APPLY_SCRIPT });
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeyDown} />

<main
	class="flex h-screen flex-col gap-1 overflow-hidden bg-[var(--color-app-surface-secondary)] font-sans text-xs text-[var(--color-app-text-primary)]">
	<MenuBar {menuItems} onAction={handleMenuAction} {songs} />
	<div class="flex-1 overflow-hidden">
		<SongView
			bind:songs
			bind:patternOrder
			bind:patternOrderColors
			bind:patternEditor
			bind:activeEditorIndex={activeSongIndex}
			bind:tables
			bind:projectSettings
			onaction={handleMenuAction}
			chipProcessors={container.audioService.chipProcessors} />
	</div>
	<ModalContainer />

	{#if themeEditorStore.editingTheme}
		<ThemeEditorModal
			theme={themeEditorStore.editingTheme.theme}
			isNew={themeEditorStore.editingTheme.isNew}
			resolve={async () => {
				const callback = themeEditorStore.onSaveCallback;
				themeEditorStore.setEditingTheme(null, false);
				await tick();
				callback?.();
			}}
			dismiss={() => {
				themeEditorStore.setEditingTheme(null, false);
			}} />
	{/if}
</main>
