import { Song, Instrument } from './song';
import type { Clip } from './clip';

class Project {
	constructor(
		public name: string = '',
		public author: string = '',
		public songs: Song[] = [],
		public loopPointId: number = 0,
		public patternOrder: number[] = [0],
		public tables: Table[] = [new Table(0, [], 0, 'Table 1')],
		public patternOrderColors: Record<number, string> = {},
		public instruments: Instrument[] = [new Instrument('01', [], 0, 'Instrument 01')],
		public clips: Clip[] = []
	) {}
}

class Table {
	id: number;
	rows: number[];
	loop: number;
	name: string;

	constructor(
		id: number,
		rows: number[],
		loop: number,
		name: string = `Table ${(id + 1).toString(36).toUpperCase()}`
	) {
		this.id = id;
		this.rows = rows;
		this.loop = loop;
		this.name = name;
	}
}

export { Project, Table };
