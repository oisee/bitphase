import { createIdentityFluffFrame } from '../fluff-frame';
import type { FluffPattern } from '../fluff-pattern';

export function createOctavedGoRound(speedGoRound: number): FluffPattern[] {
	const swap = [
		createIdentityFluffFrame(),
		createIdentityFluffFrame(),
		createIdentityFluffFrame()
	];
	swap[1].a.s = 'c';
	swap[1].b.s = 'a';
	swap[1].c.s = 'b';
	swap[2].a.s = 'b';
	swap[2].b.s = 'c';
	swap[2].c.s = 'a';

	const fpat: FluffPattern = {
		repeat: 99999,
		fframes: []
	};

	let octavedShift = -1;
	let octavedCounter = 0;

	for (const swi of swap) {
		const sw = createIdentityFluffFrame();
		sw.a.s = swi.a.s;
		sw.b.s = swi.b.s;
		sw.c.s = swi.c.s;

		for (let i = 0; i < speedGoRound; i++) {
			if (octavedCounter % speedGoRound === 0) {
				octavedShift = octavedShift * -1;
			}
			sw.a.sh = octavedShift;
			fpat.fframes.push(sw);
			octavedCounter++;
		}
	}

	return [fpat];
}
