import { describe, it, expect, vi } from 'vitest';
import {
	VirtualChannelAction,
	type VirtualChannelEditContext
} from '../../../src/lib/models/actions';
import { Song, Pattern, NoteName } from '../../../src/lib/models/song';
import { AY_CHIP_SCHEMA } from '../../../src/lib/chips/ay/schema';

function createContext(song: Song): {
	context: VirtualChannelEditContext;
	updatePatterns: ReturnType<typeof vi.fn>;
	setCursor: ReturnType<typeof vi.fn>;
	onVirtualChannelChange: ReturnType<typeof vi.fn>;
} {
	const updatePatterns = vi.fn();
	const setCursor = vi.fn();
	const onVirtualChannelChange = vi.fn();
	return {
		context: {
			patterns: song.patterns,
			song,
			updatePatterns,
			setCursor,
			onVirtualChannelChange
		},
		updatePatterns,
		setCursor,
		onVirtualChannelChange
	};
}

describe('VirtualChannelAction', () => {
	it('should apply new map and patterns on execute', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		const oldPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA)];
		const newPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA, ['A', 'B1', 'B2', 'C'])];
		const { context, updatePatterns, onVirtualChannelChange } = createContext(song);

		const action = new VirtualChannelAction(
			context, oldPatterns, newPatterns,
			{}, { 1: 2 },
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		action.execute();

		expect(song.virtualChannelMap).toEqual({ 1: 2 });
		expect(updatePatterns).toHaveBeenCalledOnce();
		expect(onVirtualChannelChange).toHaveBeenCalledOnce();
		const passedPatterns = updatePatterns.mock.calls[0][0];
		expect(passedPatterns).toHaveLength(1);
		expect(passedPatterns[0].channels).toHaveLength(4);
	});

	it('should restore old map and patterns on undo', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		song.virtualChannelMap = { 1: 2 };
		const oldPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA)];
		const newPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA, ['A', 'B1', 'B2', 'C'])];
		const { context, updatePatterns } = createContext(song);

		const action = new VirtualChannelAction(
			context, oldPatterns, newPatterns,
			{}, { 1: 2 },
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		action.undo();

		expect(song.virtualChannelMap).toEqual({});
		const passedPatterns = updatePatterns.mock.calls[0][0];
		expect(passedPatterns[0].channels).toHaveLength(3);
	});

	it('should call setCursor on both execute and undo', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		const cursor = { row: 5, column: 2, patternOrderIndex: 1 };
		const { context, setCursor } = createContext(song);

		const action = new VirtualChannelAction(
			context, song.patterns, song.patterns,
			{}, {},
			cursor
		);

		action.execute();
		expect(setCursor).toHaveBeenCalledWith(cursor);

		setCursor.mockClear();
		action.undo();
		expect(setCursor).toHaveBeenCalledWith(cursor);
	});

	it('should deep clone patterns to prevent mutation', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		const oldPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA)];
		oldPatterns[0].channels[0].rows[0].note.name = NoteName.C;

		const newPatterns = [new Pattern(0, 64, AY_CHIP_SCHEMA)];
		newPatterns[0].channels[0].rows[0].note.name = NoteName.E;

		const { context, updatePatterns } = createContext(song);

		const action = new VirtualChannelAction(
			context, oldPatterns, newPatterns,
			{}, {},
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		oldPatterns[0].channels[0].rows[0].note.name = NoteName.G;
		newPatterns[0].channels[0].rows[0].note.name = NoteName.G;

		action.undo();
		const undonePatterns = updatePatterns.mock.calls[0][0];
		expect(undonePatterns[0].channels[0].rows[0].note.name).toBe(NoteName.C);

		action.execute();
		const executedPatterns = updatePatterns.mock.calls[1][0];
		expect(executedPatterns[0].channels[0].rows[0].note.name).toBe(NoteName.E);
	});

	it('should deep clone map to prevent mutation', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		const oldMap: Record<number, number> = {};
		const newMap: Record<number, number> = { 1: 2 };
		const { context } = createContext(song);

		const action = new VirtualChannelAction(
			context, song.patterns, song.patterns,
			oldMap, newMap,
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		newMap[1] = 5;

		action.execute();
		expect(song.virtualChannelMap).toEqual({ 1: 2 });
	});

	it('should return cursor position', () => {
		const song = new Song(AY_CHIP_SCHEMA);
		const cursor = { row: 3, column: 7, patternOrderIndex: 2 };
		const { context } = createContext(song);

		const action = new VirtualChannelAction(
			context, song.patterns, song.patterns,
			{}, {}, cursor
		);

		expect(action.getCursorPosition()).toEqual(cursor);
	});
});
