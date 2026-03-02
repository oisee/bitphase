import { createIdentityFluffFrame } from '../fluff-frame';
import type { FluffPattern } from '../fluff-pattern';

export function createGoRound(speed: number): FluffPattern[] {
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

	for (const sw of swap) {
		for (let i = 0; i < speed; i++) {
			fpat.fframes.push(sw);
		}
	}

	return [fpat];
}
