import { BUILTIN_THEMES } from '../config/themes';
import type { Theme, ThemeExportFormat } from '../types/theme';

const STORAGE_KEY_ACTIVE_THEME = 'active-theme-id';
const STORAGE_KEY_CUSTOM_THEMES = 'custom-themes';
const DEFAULT_THEME_ID = 'catppuccin-mocha';

class ThemeStore {
	activeThemeId = $state(DEFAULT_THEME_ID);
	customThemes = $state<Theme[]>([]);
	previewColors = $state<Theme['colors'] | null>(null);

	init(themeService?: { applyTheme: (theme: Theme) => void }): void {
		if (typeof window === 'undefined') return;

		const savedThemeId = localStorage.getItem(STORAGE_KEY_ACTIVE_THEME);
		const savedCustomThemes = localStorage.getItem(STORAGE_KEY_CUSTOM_THEMES);

		if (savedCustomThemes) {
			try {
				this.customThemes = JSON.parse(savedCustomThemes);
			} catch {
				this.customThemes = [];
			}
		}

		if (savedThemeId && this.getAllThemes().some((t) => t.id === savedThemeId)) {
			this.activeThemeId = savedThemeId;
		} else {
			this.activeThemeId = DEFAULT_THEME_ID;
		}

		const activeTheme = this.getActiveTheme();
		if (activeTheme && themeService) {
			themeService.applyTheme(activeTheme);
		}
	}

	getActiveTheme(): Theme | undefined {
		return this.getAllThemes().find((t) => t.id === this.activeThemeId);
	}

	setActiveTheme(themeId: string): void {
		const theme = this.getAllThemes().find((t) => t.id === themeId);
		if (!theme) return;

		this.activeThemeId = themeId;
		localStorage.setItem(STORAGE_KEY_ACTIVE_THEME, themeId);
	}

	getAllThemes(): Theme[] {
		return [...BUILTIN_THEMES, ...this.customThemes];
	}

	getCustomThemes(): Theme[] {
		return this.customThemes;
	}

	addCustomTheme(theme: Theme): void {
		const exists = this.customThemes.some((t) => t.id === theme.id);
		if (exists) {
			this.updateCustomTheme(theme.id, theme);
			return;
		}

		this.customThemes = [...this.customThemes, { ...theme, isCustom: true }];
		this.saveCustomThemes();
	}

	updateCustomTheme(themeId: string, theme: Theme): void {
		const index = this.customThemes.findIndex((t) => t.id === themeId);
		if (index === -1) return;

		this.customThemes[index] = { ...theme, isCustom: true };
		this.customThemes = [...this.customThemes];
		this.saveCustomThemes();
	}

	deleteCustomTheme(themeId: string): void {
		const theme = this.customThemes.find((t) => t.id === themeId);
		if (!theme || !theme.isCustom) return;

		this.customThemes = this.customThemes.filter((t) => t.id !== themeId);
		this.saveCustomThemes();

		if (this.activeThemeId === themeId) {
			this.setActiveTheme(DEFAULT_THEME_ID);
		}
	}

	setPreviewColors(colors: Theme['colors'] | null): void {
		this.previewColors = colors;
	}

	getPreviewColors(): Theme['colors'] | null {
		return this.previewColors;
	}

	exportTheme(themeId: string): string | null {
		const theme = this.getAllThemes().find((t) => t.id === themeId);
		if (!theme) return null;

		const exportData: ThemeExportFormat = {
			version: '1.0',
			theme
		};

		return JSON.stringify(exportData, null, 2);
	}

	importTheme(json: string): Theme | null {
		try {
			const data = JSON.parse(json) as ThemeExportFormat;

			if (!data.version || !data.theme) {
				throw new Error('Invalid theme format');
			}

			if (!data.theme.id || !data.theme.name || !data.theme.colors) {
				throw new Error('Invalid theme structure');
			}

			return {
				...data.theme,
				isCustom: true
			};
		} catch {
			return null;
		}
	}

	private saveCustomThemes(): void {
		localStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(this.customThemes));
	}
}

export const themeStore = new ThemeStore();
