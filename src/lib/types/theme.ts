import type {
	PatternEditorColorKey,
	PatternOrderColorKey,
	AppColorKey
} from '../config/theme-colors';

export type PatternEditorColors = Record<PatternEditorColorKey, string>;
export type PatternOrderColors = Record<PatternOrderColorKey, string>;
export type AppColors = Record<AppColorKey, string>;

export interface ThemeColors extends PatternEditorColors, PatternOrderColors, AppColors {}

export interface Theme {
	id: string;
	name: string;
	colors: ThemeColors;
	isCustom?: boolean;
}

export interface ThemeExportFormat {
	theme: {
		name: string;
		colors: ThemeColors;
	};
}
