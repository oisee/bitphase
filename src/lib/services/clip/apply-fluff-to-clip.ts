import { Clip } from '../../models/clip';
import type { FluffPattern } from '../../fluff/fluff-pattern';
import { applyFluff } from '../../fluff/apply-fluff';

export function applyFluffToClip(clip: Clip, fluffPatterns: FluffPattern[]): Clip {
	const transformedFrames = applyFluff(clip.frames, fluffPatterns, { stopOutOfFrames: true });

	return new Clip(`${clip.name} (fluffed)`, transformedFrames, {
		sourceChannelCount: clip.sourceChannelCount,
		chipClock: clip.chipClock,
		interruptFrequency: clip.interruptFrequency,
		loopPoint: clip.loopPoint >= 0 && clip.loopPoint < transformedFrames.length
			? clip.loopPoint
			: -1
	});
}
