import { settingsStore } from './stores/settings.svelte';
import { keybindingsStore } from './stores/keybindings.svelte';
import { editorStateStore } from './stores/editor-state.svelte';
import { themeStore } from './stores/theme.svelte';
import { themeService } from './services/theme/theme-service';
import { userScriptsStore } from './stores/user-scripts.svelte';
import { alphaNoticeStore } from './stores/alpha-notice.svelte';

export function runAppBootstrap(): void {
	settingsStore.init();
	keybindingsStore.init();
	editorStateStore.init();
	themeStore.init(themeService);
	userScriptsStore.init();
	alphaNoticeStore.init();
}
