import { createIdentityFluffFrame } from '../fluff-frame';
import type { FluffPattern } from '../fluff-pattern';

export function createSyncopa(fpn = 4): FluffPattern[] {
	const fi = createIdentityFluffFrame();
	const fd = createIdentityFluffFrame();
	fd.dup = true;
	const fs = createIdentityFluffFrame();
	fs.skip = true;

	const fpat: FluffPattern = {
		repeat: 99999,
		fframes: []
	};

	const hBeat = Math.floor(fpn / 2);
	const hBeatOdd = (fpn % 2) !== 0;
	const qBeat = Math.floor(hBeat / 2);
	const qBeatOdd = (hBeat % 2) !== 0;

	for (let i = 0; i < qBeat; i++) fpat.fframes.push(fi);
	if (qBeatOdd) fpat.fframes.push(fi);
	for (let i = 0; i < qBeat; i++) fpat.fframes.push(fd);
	if (hBeatOdd) fpat.fframes.push(fi);
	for (let i = 0; i < qBeat; i++) fpat.fframes.push(fi);
	if (qBeatOdd) fpat.fframes.push(fi);
	for (let i = 0; i < qBeat; i++) fpat.fframes.push(fs);

	return [fpat];
}
