import type { ChipFrame, ChipChannel, ChipEnvelope, ChipNoise, ToneChannelKey } from './chip-frame';
import { createEmptyChipFrame, TONE_CHANNEL_KEYS } from './chip-frame';
import type { FluffFrame, FluffToneChannel, FluffEnvelopeChannel, FluffNoiseChannel, FluffGlobal } from './fluff-frame';
import type { FluffPattern } from './fluff-pattern';

const N2P = 7;

export interface ApplyFluffOptions {
	stopOutOfFrames?: boolean;
	noSoftStop?: boolean;
}

export function applyFluff(
	frames: ChipFrame[],
	fpats: FluffPattern[],
	opt: ApplyFluffOptions = {}
): ChipFrame[] {
	let afc = 0;
	const nfs: ChipFrame[] = [];
	const off = getMinMaxOffsetsPat(fpats);

	for (const fpat of fpats) {
		for (let fpatRep = 0; fpatRep < fpat.repeat; fpatRep++) {
			for (const ff of fpat.fframes) {
				for (let r = 0; r < ff.repeat; r++) {
					if (opt.stopOutOfFrames && afc >= frames.length) break;
					if (!opt.noSoftStop && afc >= frames.length - off.min) break;

					if (ff.skip) {
						afc++;
						continue;
					}

					const nf = applyFluffFrame(frames, afc, ff);
					nfs.push(nf);

					if (ff.dup) {
						nfs.push(nf);
					}

					afc++;
				}
			}
		}
	}

	applyFineR13(nfs);
	return nfs;
}

function applyFluffFrame(frames: ChipFrame[], i: number, ff: FluffFrame): ChipFrame {
	const nf = createEmptyChipFrame();

	for (const ch of TONE_CHANNEL_KEYS) {
		const fch = ff[ch];
		if (isToneChannel(fch.s)) {
			tone2tone(frames, i, fch, nf[ch]);
		} else if (fch.s === 'e') {
			env2tone(frames, i, fch, nf[ch]);
		} else if (fch.s === 'n') {
			noise2tone(frames, i, fch, nf[ch]);
		}
	}

	if (isToneChannel(ff.e.s)) {
		tone2env(frames, i, ff.e, nf.e);
	} else if (ff.e.s === 'e') {
		env2env(frames, i, ff.e, nf.e);
	} else if (ff.e.s === 'n') {
		noise2env(frames, i, ff.e, nf.e);
	}

	if (isToneChannel(ff.n.s)) {
		tone2noise(frames, i, ff.n, nf.n);
	} else if (ff.n.s === 'e') {
		env2noise(frames, i, ff.n, nf.n);
	} else if (ff.n.s === 'n') {
		noise2noise(frames, i, ff.n, nf.n);
	}

	applyGlobal(nf.a, ff.g);
	applyGlobal(nf.b, ff.g);
	applyGlobal(nf.c, ff.g);

	return nf;
}

function isToneChannel(s: string): s is ToneChannelKey {
	return s === 'a' || s === 'b' || s === 'c';
}

function getFrame(frames: ChipFrame[], off: number): ChipFrame {
	if (off < 0 || off >= frames.length) {
		return createEmptyChipFrame();
	}
	return frames[off];
}

function applyVolume(cv: number, fv: number): number {
	let nv = cv + fv;
	if (nv > 15) nv = 15;
	if (nv < 0) nv = 0;
	return nv;
}

function applyShift(p: number, sh: number, mask: number): number {
	if (sh === 0) return p & mask;
	if (sh > 0) return (p >> sh) & mask;
	return (p << -sh) & mask;
}

function tone2tone(frames: ChipFrame[], i: number, fch: FluffToneChannel, tch: ChipChannel): void {
	const cf = getFrame(frames, i + fch.o)[fch.s as ToneChannelKey] as ChipChannel;
	tch.p = fch.pa ? fch.p : cf.p + fch.p;
	tch.v = fch.va ? fch.v : applyVolume(cf.v, fch.v);
	tch.e = fch.ea ? fch.e : cf.e && fch.e;
	tch.t = fch.ta ? fch.t : cf.t && fch.t;
	tch.n = fch.na ? fch.n : cf.n && fch.n;
	tch.p = applyShift(tch.p, fch.sh, 0x0fff);
}

function env2tone(frames: ChipFrame[], i: number, fch: FluffToneChannel, tch: ChipChannel): void {
	const cf = getFrame(frames, i + fch.o).e;
	tch.p = fch.pa ? fch.p : (cf.p & 0x0fff) + fch.p;
	tch.v = 0;
	tch.e = fch.e;
	tch.t = fch.t;
	tch.n = fch.n;
	tch.p = applyShift(tch.p, fch.sh, 0x0fff);
}

function noise2tone(frames: ChipFrame[], i: number, fch: FluffToneChannel, tch: ChipChannel): void {
	const cf = getFrame(frames, i + fch.o).n;
	tch.p = fch.pa ? fch.p << N2P : ((cf.p << N2P) & 0x0fff) + fch.p;
	tch.v = 0;
	tch.e = fch.e;
	tch.t = fch.t;
	tch.n = fch.n;
	tch.p = applyShift(tch.p, fch.sh, 0x0fff);
}

function tone2env(frames: ChipFrame[], i: number, fch: FluffEnvelopeChannel, tch: ChipEnvelope): void {
	const cf = getFrame(frames, i + fch.o)[fch.s as ToneChannelKey] as ChipChannel;
	tch.p = fch.pa ? fch.p : cf.p + fch.p;
	tch.f = fch.fa ? fch.f : 0x0e & fch.f;
	tch.p = applyShift(tch.p, fch.sh, 0xfffff);
}

function env2env(frames: ChipFrame[], i: number, fch: FluffEnvelopeChannel, tch: ChipEnvelope): void {
	const cf = getFrame(frames, i + fch.o).e;
	tch.p = fch.pa ? fch.p : cf.p + fch.p;
	tch.f = fch.fa ? fch.f : cf.f & fch.f;
	tch.p = applyShift(tch.p, fch.sh, 0xfffff);
}

function noise2env(frames: ChipFrame[], i: number, fch: FluffEnvelopeChannel, tch: ChipEnvelope): void {
	const cf = getFrame(frames, i + fch.o).n;
	tch.p = fch.pa ? fch.p << N2P : ((cf.p << N2P) & 0x0fff) + fch.p;
	tch.f = fch.fa ? fch.f : 0x0e & fch.f;
	tch.p = applyShift(tch.p, fch.sh, 0xfffff);
}

function tone2noise(frames: ChipFrame[], i: number, fch: FluffNoiseChannel, tch: ChipNoise): void {
	const cf = getFrame(frames, i + fch.o)[fch.s as ToneChannelKey] as ChipChannel;
	tch.p = fch.pa ? fch.p : (cf.p >> N2P) + fch.p;
}

function env2noise(frames: ChipFrame[], i: number, fch: FluffNoiseChannel, tch: ChipNoise): void {
	const cf = getFrame(frames, i + fch.o).e;
	tch.p = fch.pa ? fch.p : (cf.p >> N2P) + fch.p;
}

function noise2noise(frames: ChipFrame[], i: number, fch: FluffNoiseChannel, tch: ChipNoise): void {
	const cf = getFrame(frames, i + fch.o).n;
	tch.p = fch.pa ? fch.p : cf.p + fch.p;
}

function applyGlobal(tch: ChipChannel, gch: FluffGlobal): void {
	tch.e = gch.ea ? gch.e : tch.e && gch.e;
	tch.t = gch.ta ? gch.t : tch.t && gch.t;
	tch.n = gch.na ? gch.n : tch.n && gch.n;
}

function applyFineR13(frames: ChipFrame[]): void {
	for (let i = 0; i < frames.length - 1; i++) {
		const cf = frames[i];
		const nf = frames[i + 1];
		if ((nf.e.f & 0x0f) !== (cf.e.f & 0x0f)) {
			nf.e.f = nf.e.f & 0x0f;
		}
	}
}

interface MinMaxOffsets {
	min: number;
	max: number;
}

function getMinMaxOffsetsPat(fpats: FluffPattern[]): MinMaxOffsets {
	const off: MinMaxOffsets = { min: 0, max: 0 };
	for (const fpat of fpats) {
		const noff = getMinMaxOffsets(fpat);
		if (noff.max > off.max) off.max = noff.max;
		if (noff.min > off.min) off.min = noff.min;
	}
	return off;
}

function getMinMaxOffsets(fpat: FluffPattern): MinMaxOffsets {
	const off: MinMaxOffsets = { min: 0, max: 0 };
	for (const ff of fpat.fframes) {
		const offsets = [ff.a.o, ff.b.o, ff.c.o, ff.e.o, ff.n.o];
		const max = Math.max(...offsets);
		const min = Math.min(...offsets);
		if (max > off.max) off.max = max;
		if (min > off.min) off.min = min;
	}
	return off;
}
