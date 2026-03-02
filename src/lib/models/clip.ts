import type { ChipFrame } from '../fluff/chip-frame';

let clipIdCounter = 0;

export class Clip {
	id: string;
	name: string;
	frames: ChipFrame[];
	loopPoint: number;
	sourceChannelCount: number;
	chipClock: number;
	interruptFrequency: number;

	constructor(
		name: string,
		frames: ChipFrame[],
		options: {
			loopPoint?: number;
			sourceChannelCount?: number;
			chipClock?: number;
			interruptFrequency?: number;
			id?: string;
		} = {}
	) {
		this.id = options.id ?? `clip_${Date.now()}_${clipIdCounter++}`;
		this.name = name;
		this.frames = frames;
		this.loopPoint = options.loopPoint ?? -1;
		this.sourceChannelCount = options.sourceChannelCount ?? 3;
		this.chipClock = options.chipClock ?? 1773400;
		this.interruptFrequency = options.interruptFrequency ?? 50;
	}

	get duration(): number {
		if (this.interruptFrequency <= 0) return 0;
		return this.frames.length / this.interruptFrequency;
	}

	get frameCount(): number {
		return this.frames.length;
	}
}
