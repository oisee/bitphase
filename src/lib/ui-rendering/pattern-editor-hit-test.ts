import type { CellPosition } from './pattern-editor-text-parser';

export function getColumnAtX(cellPositions: CellPosition[], x: number): number {
	let closestColumn = 0;
	let minDistance = Infinity;
	for (let i = 0; i < cellPositions.length; i++) {
		const cell = cellPositions[i];
		if (cell.x === undefined) continue;
		const cellCenter = cell.x + (cell.width ?? 0) / 2;
		const distance = Math.abs(x - cellCenter);
		if (distance < minDistance) {
			minDistance = distance;
			closestColumn = i;
		}
	}
	return closestColumn;
}
