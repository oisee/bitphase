import type { ChannelKey } from './chip-frame';

export interface FluffToneChannel {
	s: ChannelKey;
	o: number;
	p: number;
	pa: boolean;
	sh: number;
	v: number;
	va: boolean;
	e: boolean;
	ea: boolean;
	t: boolean;
	ta: boolean;
	n: boolean;
	na: boolean;
}

export interface FluffEnvelopeChannel {
	s: ChannelKey;
	o: number;
	p: number;
	pa: boolean;
	sh: number;
	f: number;
	fa: boolean;
}

export interface FluffNoiseChannel {
	s: ChannelKey;
	o: number;
	p: number;
	pa: boolean;
}

export interface FluffGlobal {
	t: boolean;
	ta: boolean;
	e: boolean;
	ea: boolean;
	n: boolean;
	na: boolean;
}

export interface FluffFrame {
	repeat: number;
	skip: boolean;
	dup: boolean;
	a: FluffToneChannel;
	b: FluffToneChannel;
	c: FluffToneChannel;
	e: FluffEnvelopeChannel;
	n: FluffNoiseChannel;
	g: FluffGlobal;
}

function createToneChannel(source: ChannelKey): FluffToneChannel {
	return {
		s: source,
		o: 0,
		p: 0,
		pa: false,
		sh: 0,
		v: 0,
		va: false,
		e: true,
		ea: false,
		t: true,
		ta: false,
		n: true,
		na: false
	};
}

export function createIdentityFluffFrame(): FluffFrame {
	return {
		repeat: 1,
		skip: false,
		dup: false,
		a: createToneChannel('a'),
		b: createToneChannel('b'),
		c: createToneChannel('c'),
		e: {
			s: 'e',
			o: 0,
			p: 0,
			pa: false,
			sh: 0,
			f: 0xff,
			fa: false
		},
		n: {
			s: 'n',
			o: 0,
			p: 0,
			pa: false
		},
		g: {
			t: true,
			ta: false,
			e: true,
			ea: false,
			n: true,
			na: false
		}
	};
}
