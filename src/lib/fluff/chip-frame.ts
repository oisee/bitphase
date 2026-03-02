export interface ChipChannel {
	p: number;
	v: number;
	e: boolean;
	t: boolean;
	n: boolean;
}

export interface ChipEnvelope {
	p: number;
	f: number;
}

export interface ChipNoise {
	p: number;
}

export interface ChipFrame {
	a: ChipChannel;
	b: ChipChannel;
	c: ChipChannel;
	e: ChipEnvelope;
	n: ChipNoise;
}

export function createEmptyChipFrame(): ChipFrame {
	return {
		a: { p: 0, v: 0, e: false, t: false, n: false },
		b: { p: 0, v: 0, e: false, t: false, n: false },
		c: { p: 0, v: 0, e: false, t: false, n: false },
		e: { p: 0, f: 0 },
		n: { p: 0 }
	};
}

export function chipFrameFromRegisters(ay: number[]): ChipFrame {
	return {
		a: {
			p: (ay[0] + (ay[1] << 8)) & 0x0fff,
			v: ay[8] & 0x0f,
			e: (ay[8] & 0x10) !== 0,
			t: (ay[7] & 0b000001) !== 0,
			n: (ay[7] & 0b001000) !== 0
		},
		b: {
			p: (ay[2] + (ay[3] << 8)) & 0x0fff,
			v: ay[9] & 0x0f,
			e: (ay[9] & 0x10) !== 0,
			t: (ay[7] & 0b000010) !== 0,
			n: (ay[7] & 0b010000) !== 0
		},
		c: {
			p: (ay[4] + (ay[5] << 8)) & 0x0fff,
			v: ay[10] & 0x0f,
			e: (ay[10] & 0x10) !== 0,
			t: (ay[7] & 0b000100) !== 0,
			n: (ay[7] & 0b100000) !== 0
		},
		e: {
			p: ((ay[11] + (ay[12] << 8)) & 0xffff) << 4,
			f: ay[13] & 0xff
		},
		n: {
			p: ay[6] & 0x1f
		}
	};
}

export function cloneChipFrame(frame: ChipFrame): ChipFrame {
	return {
		a: { ...frame.a },
		b: { ...frame.b },
		c: { ...frame.c },
		e: { ...frame.e },
		n: { ...frame.n }
	};
}

export type ToneChannelKey = 'a' | 'b' | 'c';
export type ChannelKey = ToneChannelKey | 'e' | 'n';

export const TONE_CHANNEL_KEYS: ToneChannelKey[] = ['a', 'b', 'c'];
export const CHANNEL_KEYS: ChannelKey[] = ['a', 'b', 'c', 'e', 'n'];
