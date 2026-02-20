export type FieldType = 'note' | 'hex' | 'symbol' | 'dec' | 'text';

export type BacktrackWhen = 'any' | 'nonZero';

export interface ChipField {
	key: string;
	type: FieldType;
	length: number;
	color?: string;
	selectable?: 'atomic' | 'character';
	skip?: boolean;
	defaultValue?: unknown;
	allowZeroValue?: boolean;
	usedForBacktracking?: boolean;
	backtrackWhen?: BacktrackWhen;
}

export type SettingType = 'text' | 'number' | 'select' | 'toggle';

export interface SettingOption {
	label: string;
	value: string | number;
}

export interface ChipSetting {
	key: string;
	label: string;
	type: SettingType;
	options?: SettingOption[];
	defaultValue?: unknown;
	group?: string;
	notifyAudioService?: boolean;
	min?: number;
	max?: number;
	step?: number;
	computedHint?: (value: unknown, context: Record<string, unknown>) => string;
	fullWidth?: boolean;
	dependsOn?: string[];
	dynamicOption?: { value: number; label: (context: Record<string, unknown>) => string };
	showWhen?: { key: string; value: unknown };
	startNewRow?: boolean;
}

export interface ChipSchema {
	chipType: string;
	template: string;
	fields: Record<string, ChipField>;
	globalTemplate?: string;
	globalFields?: Record<string, ChipField>;
	channelLabels?: string[];
	globalColumnLabels?: Record<string, string>;
	settings?: ChipSetting[];
	defaultTuningTable?: number[];
	defaultChipVariant?: string;
	resolveTuningTable?: (song: Record<string, unknown>) => number[];
	tuningTableSettingKeys?: string[];
}

export function applySchemaDefaults<T extends object>(target: T, schema: ChipSchema): void {
	if (!schema.settings) return;

	for (const setting of schema.settings) {
		if (setting.defaultValue !== undefined) {
			const key = setting.key;
			const currentValue = (target as any)[key];
			if (currentValue === undefined) {
				(target as any)[key] = setting.defaultValue;
			}
		}
	}
}

export function getGlobalColumnLabel(schema: ChipSchema, fieldKey: string): string {
	return schema.globalColumnLabels?.[fieldKey] ?? fieldKey;
}

export function getDefaultForFieldType(
	type: FieldType,
	fieldKey?: string,
	allowZeroValue?: boolean
): unknown {
	switch (type) {
		case 'hex':
		case 'dec':
		case 'symbol':
			return 0;
		case 'note':
			return null;
		case 'text':
			return '';
		default:
			return 0;
	}
}
