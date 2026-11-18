export const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'bitphase-right-panel-width';
export const RIGHT_PANEL_DEFAULT_WIDTH = 512;
export const RIGHT_PANEL_MIN_WIDTH = 380;
export const RIGHT_PANEL_MAX_WIDTH = 900;

export function clampRightPanelWidth(width: number): number {
	if (!Number.isFinite(width)) return RIGHT_PANEL_DEFAULT_WIDTH;
	return Math.round(Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, width)));
}

export function loadRightPanelWidth(storage: Pick<Storage, 'getItem'> | undefined): number {
	try {
		const stored = storage?.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY);
		return stored ? clampRightPanelWidth(Number(stored)) : RIGHT_PANEL_DEFAULT_WIDTH;
	} catch {
		return RIGHT_PANEL_DEFAULT_WIDTH;
	}
}

export function saveRightPanelWidth(
	storage: Pick<Storage, 'setItem'> | undefined,
	width: number
): void {
	try {
		storage?.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(clampRightPanelWidth(width)));
	} catch {
		// storage unavailable: the width is kept for this session only
	}
}

export const RIGHT_PANEL_KEYBOARD_STEP = 16;

// The handle sits on the panel's left edge: ArrowLeft widens the panel, ArrowRight narrows it.
// Returns null for other keys.
export function rightPanelWidthAfterKey(width: number, key: string): number | null {
	if (key === 'ArrowLeft') return clampRightPanelWidth(width + RIGHT_PANEL_KEYBOARD_STEP);
	if (key === 'ArrowRight') return clampRightPanelWidth(width - RIGHT_PANEL_KEYBOARD_STEP);
	return null;
}

// Dragging the handle on the panel's left edge to the left widens the panel.
export function rightPanelWidthAfterDrag(startWidth: number, startX: number, x: number): number {
	return clampRightPanelWidth(startWidth + (startX - x));
}
