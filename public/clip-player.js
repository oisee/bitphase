class ClipPlayer {
	constructor() {
		this.clips = {};
		this.activeClips = {};
	}

	loadClip(clipId, frames, loopPoint) {
		this.clips[clipId] = {
			frames: frames,
			loopPoint: loopPoint ?? -1
		};
	}

	removeClip(clipId) {
		delete this.clips[clipId];
		delete this.activeClips[clipId];
	}

	startClip(clipId, channelIndex) {
		const clip = this.clips[clipId];
		if (!clip) return;

		this.activeClips[clipId] = {
			channelIndex: channelIndex,
			frameIndex: 0,
			playing: true
		};
	}

	stopClip(clipId) {
		delete this.activeClips[clipId];
	}

	stopAll() {
		this.activeClips = {};
	}

	applyClips(registerState) {
		for (const clipId of Object.keys(this.activeClips)) {
			const active = this.activeClips[clipId];
			if (!active.playing) continue;

			const clip = this.clips[clipId];
			if (!clip) continue;

			if (active.frameIndex >= clip.frames.length) {
				if (clip.loopPoint >= 0 && clip.loopPoint < clip.frames.length) {
					active.frameIndex = clip.loopPoint;
				} else {
					active.playing = false;
					delete this.activeClips[clipId];
					continue;
				}
			}

			const frame = clip.frames[active.frameIndex];
			this.applyFrameToChannel(registerState, active.channelIndex, frame);
			active.frameIndex++;
		}
	}

	applyFrameToChannel(registerState, channelIndex, frame) {
		const channelKeys = ['a', 'b', 'c'];
		for (let i = 0; i < channelKeys.length; i++) {
			const targetCh = channelIndex + i;
			if (targetCh >= registerState.channelCount) break;

			const src = frame[channelKeys[i]];
			if (!src) continue;

			registerState.channels[targetCh].tone = src.p;
			registerState.channels[targetCh].volume = src.v;
			registerState.channels[targetCh].mixer = {
				tone: src.t,
				noise: src.n,
				envelope: src.e
			};
		}

		registerState.noise = frame.n.p;
		registerState.envelopePeriod = frame.e.p;
		if (frame.e.f !== undefined) {
			registerState.envelopeShape = frame.e.f & 0x0f;
		}
	}

	hasActiveClips() {
		return Object.keys(this.activeClips).length > 0;
	}

	clear() {
		this.clips = {};
		this.activeClips = {};
	}
}

export default ClipPlayer;
