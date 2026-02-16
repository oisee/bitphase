import type { PatternEditorTextParser, FieldSegment } from './pattern-editor-text-parser';
import type { Chip } from '../chips/types';
import { BaseCanvasRenderer, type BaseRenderOptions } from './base-canvas-renderer';
import { PatternTemplateParser } from '../services/pattern/editing/pattern-template-parsing';
import type { getColors } from '../utils/colors';

export interface PatternEditorRenderOptions extends Omit<BaseRenderOptions, 'colors'> {
	colors: ReturnType<typeof getColors>;
	lineHeight: number;
	schema: Chip['schema'];
	channelSeparatorWidth: number;
}

export interface RowRenderData {
	rowString: string;
	y: number;
	isSelected: boolean;
	rowIndex: number;
	selectedColumn: number;
	segments: FieldSegment[];
	cellPositions: ReturnType<PatternEditorTextParser['getCellPositions']>;
	channelMuted: boolean[];
	selectionStartCol?: number | null;
	selectionEndCol?: number | null;
}

export interface ChannelLabelData {
	rowString: string;
	channelLabels: string[];
	channelMuted: boolean[];
}

export class PatternEditorRenderer extends BaseCanvasRenderer {
	private lineHeight: number;
	private schema: Chip['schema'];
	private patternColors: ReturnType<typeof getColors>;
	private channelSeparatorWidth: number;

	constructor(options: PatternEditorRenderOptions) {
		super(options);
		this.lineHeight = options.lineHeight;
		this.schema = options.schema;
		this.patternColors = options.colors;
		this.channelSeparatorWidth = options.channelSeparatorWidth;
	}

	drawRow(data: RowRenderData): void {
		this.drawRowBackground(data);
		this.drawRowText(data);
	}

	drawChannelLabels(data: ChannelLabelData): void {
		const channelPositions = this.calculateChannelPositions(data.rowString);
		const labelY = this.lineHeight / 2;
		const borderWidth = 1;

		this.fillRect(0, 0, this.canvasWidth, this.lineHeight, this.patternColors.patternBg);

		this.save();
		const currentFont = this.ctx.font;
		let boldFont = currentFont;
		if (!/\b(bold|700|800|900)\b/.test(currentFont)) {
			boldFont = currentFont.replace(/^(\d+px\s+)/, '$1bold ');
		}
		this.setFont(boldFont);

		if (this.schema.globalColumnLabels) {
			const globalPositions = this.calculateGlobalColumnPositions(data.rowString);
			const textColor = this.patternColors.patternRowNum || this.patternColors.patternText;
			for (const { fieldKey, x, width } of globalPositions) {
				const label = this.schema.globalColumnLabels[fieldKey];
				if (label) {
					const labelWidth = this.measureText(label);
					const textX = x + (width - labelWidth) / 2;
					this.fillText(label, textX, labelY, textColor);
				}
			}
		}

		const separatorMargin = 4;

		for (let i = 0; i < data.channelLabels.length && i < channelPositions.length; i++) {
			const label = `Channel ${data.channelLabels[i]}`;
			const channelStart = channelPositions[i];
			const channelEnd =
				i < channelPositions.length - 1 ? channelPositions[i + 1] : this.canvasWidth;
			const buttonX = Math.max(0, channelStart - separatorMargin);
			const buttonEnd =
				i < channelPositions.length - 1 ? channelEnd - separatorMargin : this.canvasWidth;
			const buttonWidth = buttonEnd - buttonX;
			const buttonHeight = this.lineHeight - 4;
			const buttonY = (this.lineHeight - buttonHeight) / 2;
			const labelWidth = this.measureText(label);
			const textX = buttonX + (buttonWidth - labelWidth) / 2;
			const isMuted = data.channelMuted[i] ?? false;
			const textColor = isMuted
				? this.patternColors.patternEmpty
				: this.patternColors.patternRowNum || this.patternColors.patternText;
			const borderColor = isMuted
				? this.patternColors.patternEmpty
				: this.patternColors.patternCellSelected ||
					this.patternColors.patternSelected ||
					this.patternColors.patternText;
			const bgColor = this.patternColors.patternSelected || this.patternColors.patternBg;

			this.fillRectWithAlpha(buttonX, buttonY, buttonWidth, buttonHeight, bgColor, 0.3);

			this.save();
			this.ctx.globalAlpha = 0.4;
			this.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight, borderColor, borderWidth);
			this.restore();

			this.fillText(label, textX, labelY, textColor);
		}

		this.restore();
	}

	drawChannelSeparators(rowString: string, canvasHeight: number): void {
		const channelPositions = this.calculateChannelPositions(rowString);

		if (channelPositions.length === 0 || this.channelSeparatorWidth <= 0) return;

		this.save();
		this.ctx.strokeStyle =
			this.patternColors.patternChannelSeparator || this.patternColors.patternEmpty;
		this.ctx.lineWidth = this.channelSeparatorWidth;

		const margin = 4;
		const startY = this.lineHeight;

		for (let i = 0; i < channelPositions.length; i++) {
			const x = Math.floor(channelPositions[i] - margin) + 0.5;
			this.beginPath();
			this.moveTo(x, startY);
			this.lineTo(x, canvasHeight);
			this.stroke();
		}

		this.restore();
	}

	calculateGlobalColumnPositions(
		rowString: string
	): Array<{ fieldKey: string; x: number; width: number }> {
		const result: Array<{ fieldKey: string; x: number; width: number }> = [];
		if (!this.schema.globalTemplate || !this.schema.globalFields) return result;

		let pos = PatternTemplateParser.skipRowNumber(rowString, 0);
		let x = 10;
		for (let i = 0; i < pos; i++) {
			x += this.measureText(rowString[i]);
		}

		PatternTemplateParser.parseTemplate(
			this.schema.globalTemplate,
			this.schema.globalFields,
			(key, field, isSpace) => {
				if (isSpace) {
					if (pos < rowString.length && rowString[pos] === ' ') {
						x += this.measureText(' ');
						pos++;
					}
				} else {
					const startX = x;
					const segment = rowString.substring(pos, pos + field.length);
					const width = this.measureText(segment);
					result.push({ fieldKey: key, x: startX, width });
					x += width;
					pos += field.length;
				}
			}
		);
		return result;
	}

	calculateChannelPositions(rowString: string): number[] {
		const positions: number[] = [];
		let x = 10;
		let i = 0;

		const advanceChar = () => {
			if (i < rowString.length) {
				const char = rowString[i];
				x += this.measureText(char);
				i++;
			}
		};

		const skipSpaces = () => {
			while (i < rowString.length && rowString[i] === ' ') {
				x += this.measureText(' ');
				i++;
			}
		};

		skipSpaces();

		while (i < rowString.length && rowString[i] !== ' ') {
			advanceChar();
		}
		skipSpaces();

		if (this.schema.globalTemplate && this.schema.globalFields) {
			PatternTemplateParser.parseTemplate(
				this.schema.globalTemplate,
				this.schema.globalFields,
				(key, field, isSpace) => {
					if (isSpace) {
						if (i < rowString.length && rowString[i] === ' ') {
							advanceChar();
						}
					} else {
						for (let j = 0; j < field.length && i < rowString.length; j++) {
							advanceChar();
						}
					}
				}
			);
			skipSpaces();
		}

		const template = this.schema.template;
		while (i < rowString.length) {
			skipSpaces();
			if (i >= rowString.length) break;

			const channelStart = x;
			let foundField = false;

			PatternTemplateParser.parseTemplate(
				template,
				this.schema.fields,
				(key, field, isSpace) => {
					if (isSpace) {
						if (i < rowString.length && rowString[i] === ' ') {
							advanceChar();
						}
					} else {
						for (let j = 0; j < field.length && i < rowString.length; j++) {
							advanceChar();
						}
						foundField = true;
					}
				}
			);

			if (foundField) {
				positions.push(channelStart);
			} else {
				break;
			}
		}

		return positions;
	}

	private isAlternateRow(rowIndex: number): boolean {
		return rowIndex % 4 === 0;
	}

	private drawRowBackground(data: RowRenderData): void {
		if (this.isAlternateRow(data.rowIndex)) {
			this.fillRect(
				0,
				data.y,
				this.canvasWidth,
				this.lineHeight,
				this.patternColors.patternAlternate
			);
		}

		if (
			data.selectionStartCol !== null &&
			data.selectionStartCol !== undefined &&
			data.selectionEndCol !== null &&
			data.selectionEndCol !== undefined
		) {
			const startCol = Math.min(data.selectionStartCol, data.selectionEndCol);
			const endCol = Math.max(data.selectionStartCol, data.selectionEndCol);

			if (startCol < data.cellPositions.length && endCol < data.cellPositions.length) {
				const firstCell = data.cellPositions[startCol];
				const lastCell = data.cellPositions[endCol];
				const selectionX = Math.floor(firstCell.x);
				const selectionWidth = Math.ceil(lastCell.x + lastCell.width) - selectionX;

				this.fillRectWithAlpha(
					selectionX,
					data.y,
					selectionWidth,
					this.lineHeight,
					this.patternColors.patternCellSelected,
					0.25
				);
			}
		} else if (data.isSelected) {
			this.fillRect(
				0,
				data.y,
				this.canvasWidth,
				this.lineHeight,
				this.patternColors.patternSelected
			);
		}

		if (
			data.isSelected &&
			data.selectedColumn < data.cellPositions.length &&
			(data.selectionStartCol === null || data.selectionStartCol === undefined)
		) {
			const cellPos = data.cellPositions[data.selectedColumn];
			this.fillRect(
				cellPos.x - 1,
				data.y,
				cellPos.width + 2,
				this.lineHeight,
				this.patternColors.patternCellSelected
			);
		}
	}

	private drawRowText(data: RowRenderData): void {
		let x = 10;
		let segmentIndex = 0;
		let currentSegment = data.segments[0];
		const originalAlpha = this.ctx.globalAlpha;

		for (let i = 0; i < data.rowString.length; i++) {
			const char = data.rowString[i];

			if (char === ' ') {
				x += this.measureText(' ');
				continue;
			}

			while (currentSegment && i >= currentSegment.end) {
				segmentIndex++;
				currentSegment = data.segments[segmentIndex];
			}

			const channelIndex = this.getChannelIndexForChar(data, currentSegment, i);
			const isMuted = channelIndex >= 0 && data.channelMuted[channelIndex];

			if (isMuted) {
				this.ctx.globalAlpha = originalAlpha * 0.4;
			} else {
				this.ctx.globalAlpha = originalAlpha;
			}

			const color = this.determineCharColor(char, data, currentSegment, i);
			this.fillText(char, x, data.y + this.lineHeight / 2, color);
			x += this.measureText(char);
		}

		this.ctx.globalAlpha = originalAlpha;
	}

	private getChannelIndexForChar(
		data: RowRenderData,
		currentSegment: FieldSegment | undefined,
		charIndex: number
	): number {
		if (!currentSegment) return -1;

		const field =
			this.schema.fields[currentSegment.fieldKey] ||
			this.schema.globalFields?.[currentSegment.fieldKey];
		if (!field) return -1;

		const isGlobal = !!this.schema.globalFields?.[currentSegment.fieldKey];
		if (isGlobal) return -1;

		let pos = PatternTemplateParser.skipRowNumber(data.rowString, 0);
		pos = PatternTemplateParser.parseGlobalTemplate(data.rowString, pos, this.schema);

		let channelIndex = 0;
		const template = this.schema.template;

		while (pos < charIndex && pos < data.rowString.length) {
			pos = PatternTemplateParser.skipSpaces(data.rowString, pos);
			if (pos >= data.rowString.length || pos >= charIndex) break;

			let channelStart = pos;
			PatternTemplateParser.parseTemplate(
				template,
				this.schema.fields,
				(key, field, isSpace) => {
					if (isSpace) {
						if (pos < data.rowString.length && data.rowString[pos] === ' ') {
							pos++;
						}
					} else {
						if (pos < charIndex) {
							pos += field.length;
						}
					}
				}
			);

			if (pos === channelStart) break;

			if (pos < charIndex) {
				channelIndex++;
			} else {
				break;
			}
		}

		return channelIndex;
	}

	private getEmptyFieldColor(data: RowRenderData): string {
		if (data.isSelected) {
			return this.patternColors.patternEmptySelected;
		}
		return this.isAlternateRow(data.rowIndex)
			? this.patternColors.patternAlternateEmpty
			: this.patternColors.patternEmpty;
	}

	private determineCharColor(
		char: string,
		data: RowRenderData,
		currentSegment: FieldSegment | undefined,
		index: number
	): string {
		let color = this.patternColors.patternText;
		if (currentSegment) {
			color = currentSegment.color;
		}

		const fieldText = currentSegment
			? data.rowString.substring(currentSegment.start, currentSegment.end)
			: '';

		const field =
			currentSegment &&
			(this.schema.fields[currentSegment.fieldKey] ||
				this.schema.globalFields?.[currentSegment.fieldKey]);

		const isEmptyField = fieldText && fieldText.split('').every((c) => c === '.' || c === '-');

		if ((char === '.' || char === '-') && isEmptyField) {
			const isAtomic = field?.selectable === 'atomic';
			if (isAtomic) {
				if (fieldText === '---') {
					return this.getEmptyFieldColor(data);
				} else {
					return color;
				}
			} else {
				return this.getEmptyFieldColor(data);
			}
		}

		if (currentSegment && !isEmptyField) {
			const isNoteField = field?.type === 'note';
			const isEffectField =
				currentSegment.fieldKey === 'effect' ||
				currentSegment.fieldKey === 'envelopeEffect';

			if (char === '.' && isEffectField) {
				return this.getEmptyFieldColor(data);
			}

			if (isNoteField) {
				if (fieldText === 'OFF') {
					return this.patternColors.patternNoteOff;
				}

				const validNotePattern = /^[A-G][#-]\d$/;
				const isPartOfValidNote = validNotePattern.test(fieldText);

				if ((char === '.' || char === '-') && !isPartOfValidNote) {
					return this.getEmptyFieldColor(data);
				}
			}

			const isTableField = currentSegment?.fieldKey === 'table';
			if (isTableField && fieldText === '0') {
				return this.patternColors.patternTableOff;
			}
		}

		return color;
	}
}
