import type { Pattern } from '../../models/song';
import type { NavigationState, NavigationContext } from './pattern-navigation';
import { PatternNavigationService } from './pattern-navigation';
import { ProgressiveSelectionService } from './progressive-selection-service';
import { ShortcutString } from '../../utils/shortcut-string';
import { keybindingsStore } from '../../stores/keybindings.svelte';
import {
	PATTERN_EDITOR_ACTION_IDS,
	ACTION_UNDO,
	ACTION_REDO,
	ACTION_COPY,
	ACTION_CUT,
	ACTION_PASTE,
	ACTION_PASTE_WITHOUT_ERASING,
	ACTION_SELECT_ALL,
	ACTION_INCREMENT_VALUE,
	ACTION_DECREMENT_VALUE,
	ACTION_TRANSPOSE_OCTAVE_UP,
	ACTION_TRANSPOSE_OCTAVE_DOWN,
	ACTION_APPLY_SCRIPT,
	ACTION_TOGGLE_PLAYBACK,
	ACTION_CYCLE_CHANNEL,
	ACTION_SWAP_CHANNEL_LEFT,
	ACTION_SWAP_CHANNEL_RIGHT
} from '../../config/keybindings';

export interface PatternKeyboardShortcutsContext {
	isPlaying: boolean;
	selectedColumn: number;
	selectedRow: number;
	currentPatternOrderIndex: number;
	pattern: Pattern;
	hasSelection: () => boolean;
	onUndo: () => void;
	onRedo: () => void;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onPasteWithoutErasing: () => void;
	onDelete: () => void;
	onSelectAll: (column: number, startRow: number, endRow: number) => void;
	onSelectProgressive: (
		startRow: number,
		endRow: number,
		startColumn: number,
		endColumn: number
	) => void;
	onTogglePlayback: () => void;
	onPausePlayback: () => void;
	onMoveRow: (delta: number) => void;
	onMoveColumn: (delta: number) => void;
	onSetSelectedRow: (row: number) => void;
	onSetSelectedColumn: (column: number) => void;
	onSetCurrentPatternOrderIndex: (index: number) => void;
	onClearSelection: () => void;
	onSetSelectionAnchor: (row: number, column: number) => void;
	onExtendSelection: (row: number, column: number) => void;
	onIncrementFieldValue: (
		delta: number,
		isOctaveIncrement?: boolean,
		keyForPreview?: string
	) => void;
	onSwapChannelLeft: () => void;
	onSwapChannelRight: () => void;
	selectionStartRow: number | null;
	selectionStartColumn: number | null;
	selectionEndRow: number | null;
	selectionEndColumn: number | null;
	getPatternRowData: (pattern: Pattern, rowIndex: number) => string;
	navigationContext: NavigationContext;
}

export interface KeyboardShortcutResult {
	handled: boolean;
	shouldPreventDefault: boolean;
}

function dispatchCommandAction(
	action: string,
	ctx: PatternKeyboardShortcutsContext,
	event?: KeyboardEvent
): boolean {
	switch (action) {
		case ACTION_UNDO:
			ctx.onUndo();
			return true;
		case ACTION_REDO:
			ctx.onRedo();
			return true;
		case ACTION_COPY:
			ctx.onCopy();
			return true;
		case ACTION_CUT:
			ctx.onCut();
			return true;
		case ACTION_PASTE:
			ctx.onPaste();
			return true;
		case ACTION_PASTE_WITHOUT_ERASING:
			ctx.onPasteWithoutErasing();
			return true;
		case ACTION_SELECT_ALL:
			if (!ctx.isPlaying) {
				const result = ProgressiveSelectionService.selectAll(
					ctx.pattern,
					ctx.selectedColumn,
					ctx.selectionStartRow,
					ctx.selectionStartColumn,
					ctx.selectionEndRow,
					ctx.selectionEndColumn,
					ctx.navigationContext.getCellPositions,
					ctx.getPatternRowData,
					ctx.navigationContext.schema
				);
				ctx.onSelectProgressive(
					result.startRow,
					result.endRow,
					result.startColumn,
					result.endColumn
				);
			}
			return true;
		case ACTION_INCREMENT_VALUE:
			if (!ctx.isPlaying) {
				ctx.onIncrementFieldValue(1, false, event?.key);
			}
			return true;
		case ACTION_DECREMENT_VALUE:
			if (!ctx.isPlaying) {
				ctx.onIncrementFieldValue(-1, false, event?.key);
			}
			return true;
		case ACTION_TRANSPOSE_OCTAVE_UP:
			if (!ctx.isPlaying) {
				ctx.onIncrementFieldValue(1, true, event?.key);
			}
			return true;
		case ACTION_TRANSPOSE_OCTAVE_DOWN:
			if (!ctx.isPlaying) {
				ctx.onIncrementFieldValue(-1, true, event?.key);
			}
			return true;
		case ACTION_TOGGLE_PLAYBACK:
			if (ctx.isPlaying) {
				ctx.onPausePlayback();
			} else {
				ctx.onTogglePlayback();
			}
			return true;
		case ACTION_CYCLE_CHANNEL:
			if (!ctx.isPlaying) {
				const newState = PatternNavigationService.moveToNextChannel(
					{
						selectedRow: ctx.selectedRow,
						currentPatternOrderIndex: ctx.currentPatternOrderIndex,
						selectedColumn: ctx.selectedColumn
					},
					ctx.navigationContext
				);
				ctx.onClearSelection();
				ctx.onSetSelectedColumn(newState.selectedColumn);
			}
			return true;
		case ACTION_SWAP_CHANNEL_LEFT:
			if (!ctx.isPlaying) {
				ctx.onSwapChannelLeft();
			}
			return true;
		case ACTION_SWAP_CHANNEL_RIGHT:
			if (!ctx.isPlaying) {
				ctx.onSwapChannelRight();
			}
			return true;
		default:
			return false;
	}
}

export class PatternKeyboardShortcutsService {
	static handleKeyDown(
		event: KeyboardEvent,
		shortcutsContext: PatternKeyboardShortcutsContext
	): KeyboardShortcutResult {
		const isModifier = event.shiftKey;
		const key = event.key.toLowerCase();

		const shortcut = ShortcutString.fromEvent(event);
		const action = keybindingsStore.getActionForShortcut(shortcut);
		if (action !== null) {
			if (action === ACTION_APPLY_SCRIPT) {
				return { handled: false, shouldPreventDefault: false };
			}
			if (PATTERN_EDITOR_ACTION_IDS.has(action)) {
				const result = dispatchCommandAction(action, shortcutsContext, event);
				if (result) {
					return { handled: true, shouldPreventDefault: true };
				}
			}
		}

		if ((event.ctrlKey || event.metaKey) && !isModifier) {
			return { handled: false, shouldPreventDefault: false };
		}

		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			shortcutsContext.hasSelection()
		) {
			shortcutsContext.onDelete();
			return { handled: true, shouldPreventDefault: true };
		}

		switch (event.key) {
			case 'ArrowUp':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							-1
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(-1);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowDown':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							1
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(1);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowLeft':
				if (event.shiftKey) {
					if (!shortcutsContext.hasSelection()) {
						shortcutsContext.onSetSelectionAnchor(
							shortcutsContext.selectedRow,
							shortcutsContext.selectedColumn
						);
					}
					const newState = PatternNavigationService.moveColumnByDelta(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext,
						-1
					);
					shortcutsContext.onExtendSelection(
						newState.selectedRow,
						newState.selectedColumn
					);
					shortcutsContext.onSetSelectedColumn(newState.selectedColumn);
				} else {
					shortcutsContext.onClearSelection();
					shortcutsContext.onMoveColumn(-1);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowRight':
				if (event.shiftKey) {
					if (!shortcutsContext.hasSelection()) {
						shortcutsContext.onSetSelectionAnchor(
							shortcutsContext.selectedRow,
							shortcutsContext.selectedColumn
						);
					}
					const newState = PatternNavigationService.moveColumnByDelta(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext,
						1
					);
					shortcutsContext.onExtendSelection(
						newState.selectedRow,
						newState.selectedColumn
					);
					shortcutsContext.onSetSelectedColumn(newState.selectedColumn);
				} else {
					shortcutsContext.onClearSelection();
					shortcutsContext.onMoveColumn(1);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'PageUp':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							-16
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(-16);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'PageDown':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							16
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(16);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'Home':
				if (event.ctrlKey || event.metaKey) {
					if (!shortcutsContext.isPlaying) {
						if (event.shiftKey) {
							shortcutsContext.onExtendSelection(0, shortcutsContext.selectedColumn);
						} else {
							shortcutsContext.onClearSelection();
						}
						shortcutsContext.onSetSelectedRow(0);
					}
				} else {
					if (event.shiftKey) {
						shortcutsContext.onExtendSelection(shortcutsContext.selectedRow, 0);
					} else {
						shortcutsContext.onClearSelection();
					}
					shortcutsContext.onSetSelectedColumn(0);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'End':
				if (event.ctrlKey || event.metaKey) {
					if (!shortcutsContext.isPlaying) {
						if (event.shiftKey) {
							shortcutsContext.onExtendSelection(
								shortcutsContext.pattern.length - 1,
								shortcutsContext.selectedColumn
							);
						} else {
							shortcutsContext.onClearSelection();
						}
						shortcutsContext.onSetSelectedRow(shortcutsContext.pattern.length - 1);
					}
				} else {
					const navigationState = PatternNavigationService.moveToRowEnd(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext
					);
					if (event.shiftKey) {
						shortcutsContext.onExtendSelection(
							shortcutsContext.selectedRow,
							navigationState.selectedColumn
						);
					} else {
						shortcutsContext.onClearSelection();
					}
					shortcutsContext.onSetSelectedColumn(navigationState.selectedColumn);
				}
				return { handled: true, shouldPreventDefault: true };
			case '+':
			case '=':
				if (!shortcutsContext.isPlaying) {
					shortcutsContext.onIncrementFieldValue(1, isModifier, event.key);
				}
				return { handled: true, shouldPreventDefault: true };
			case '-':
			case '_':
				if (!shortcutsContext.isPlaying) {
					shortcutsContext.onIncrementFieldValue(-1, isModifier, event.key);
				}
				return { handled: true, shouldPreventDefault: true };
		}

		return { handled: false, shouldPreventDefault: false };
	}
}
