import type { Theme } from '../types/theme';

class ThemeEditorStore {
	editingTheme = $state<{ theme: Theme; isNew: boolean } | null>(null);
	onSaveCallback = $state<(() => void) | null>(null);

	setEditingTheme(theme: Theme | null, isNew: boolean, onSave?: () => void): void {
		this.editingTheme = theme ? { theme, isNew } : null;
		this.onSaveCallback = onSave || null;
	}
}

export const themeEditorStore = new ThemeEditorStore();
