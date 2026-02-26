import { describe, it, expect, beforeEach } from 'vitest';
import VirtualChannelMixer from '../../public/virtual-channel-mixer.js';
import AYChipRegisterState from '../../public/ay-chip-register-state.js';

function createState(channelCount: number) {
	return {
		channelSoundEnabled: Array(channelCount).fill(true),
		channelCurrentAlpha: Array(channelCount).fill(15)
	};
}

describe('VirtualChannelMixer', () => {
	let mixer: InstanceType<typeof VirtualChannelMixer>;

	beforeEach(() => {
		mixer = new VirtualChannelMixer();
	});

	describe('configuration', () => {
		it('should report no virtual channels by default', () => {
			expect(mixer.hasVirtualChannels()).toBe(false);
		});

		it('should report virtual channels after configuration', () => {
			mixer.configure({ 1: 2 }, 3);
			expect(mixer.hasVirtualChannels()).toBe(true);
		});

		it('should report no virtual channels when all counts are 1', () => {
			mixer.configure({ 0: 1, 1: 1, 2: 1 }, 3);
			expect(mixer.hasVirtualChannels()).toBe(false);
		});

		it('should compute total virtual channel count', () => {
			mixer.configure({ 0: 2, 1: 3, 2: 1 }, 3);
			expect(mixer.getTotalVirtualChannelCount()).toBe(6);
		});
	});

	describe('merge', () => {
		it('should pass through when each hardware channel has 1 virtual channel', () => {
			mixer.configure({}, 3);
			const registerState = new AYChipRegisterState(3);
			registerState.channels[0].tone = 100;
			registerState.channels[1].tone = 200;
			registerState.channels[2].tone = 300;
			registerState.noise = 5;
			registerState.envelopePeriod = 1000;

			const state = createState(3);
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
			expect(result.channels[1].tone).toBe(200);
			expect(result.channels[2].tone).toBe(300);
			expect(result.noise).toBe(5);
			expect(result.envelopePeriod).toBe(1000);
		});

		it('should select highest-priority active virtual channel', () => {
			mixer.configure({ 1: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 15;
			registerState.channels[2].tone = 300;
			registerState.channels[2].volume = 10;
			registerState.channels[3].tone = 400;

			const state = createState(4);
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
			expect(result.channels[1].tone).toBe(200);
			expect(result.channels[2].tone).toBe(400);
		});

		it('should select lower-priority channel when higher-priority is silent', () => {
			mixer.configure({ 1: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 0;
			registerState.channels[2].tone = 300;
			registerState.channels[2].volume = 8;
			registerState.channels[3].tone = 400;

			const state = createState(4);
			const result = mixer.merge(registerState, state);

			expect(result.channels[1].tone).toBe(300);
		});

		it('should fall back to primary virtual channel when all are inactive', () => {
			mixer.configure({ 1: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 0;
			registerState.channels[2].tone = 300;
			registerState.channels[2].volume = 0;
			registerState.channels[3].tone = 400;

			const state = createState(4);
			state.channelSoundEnabled[1] = false;
			state.channelSoundEnabled[2] = false;
			const result = mixer.merge(registerState, state);

			expect(result.channels[1].tone).toBe(200);
		});

		it('should treat envelope volume flag as active', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].volume = 0x10;
			registerState.channels[0].tone = 100;
			registerState.channels[1].volume = 5;
			registerState.channels[1].tone = 200;

			const state = createState(4);
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
		});

		it('should copy mixer flags (tone, noise, envelope)', () => {
			mixer.configure({ 1: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[1].volume = 10;
			registerState.channels[1].mixer.tone = true;
			registerState.channels[1].mixer.noise = false;
			registerState.channels[1].mixer.envelope = true;

			const state = createState(4);
			const result = mixer.merge(registerState, state);

			expect(result.channels[1].mixer.tone).toBe(true);
			expect(result.channels[1].mixer.noise).toBe(false);
			expect(result.channels[1].mixer.envelope).toBe(true);
		});

		it('should let underlying channel punch through when primary alpha is 0', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 8;

			const state = createState(4);
			state.channelCurrentAlpha[0] = 0;
			state.channelCurrentAlpha[1] = 15;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(200);
		});

		it('should let underlying win when its alpha exceeds primary alpha', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 8;

			const state = createState(4);
			state.channelCurrentAlpha[0] = 5;
			state.channelCurrentAlpha[1] = 10;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(200);
		});

		it('should keep primary when its alpha equals underlying alpha', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 8;

			const state = createState(4);
			state.channelCurrentAlpha[0] = 10;
			state.channelCurrentAlpha[1] = 10;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
		});

		it('should keep primary with alpha F regardless of underlying', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 8;

			const state = createState(4);
			state.channelCurrentAlpha[0] = 15;
			state.channelCurrentAlpha[1] = 15;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
		});

		it('should skip inactive underlying channels during alpha resolution', () => {
			mixer.configure({ 0: 3 }, 3);
			const registerState = new AYChipRegisterState(5);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 0;
			registerState.channels[2].tone = 300;
			registerState.channels[2].volume = 8;

			const state = createState(5);
			state.channelCurrentAlpha[0] = 0;
			state.channelCurrentAlpha[1] = 15;
			state.channelSoundEnabled[1] = false;
			state.channelCurrentAlpha[2] = 15;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(300);
		});

		it('should fall back to primary when underlying alpha does not exceed primary', () => {
			mixer.configure({ 0: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.channels[0].tone = 100;
			registerState.channels[0].volume = 10;
			registerState.channels[1].tone = 200;
			registerState.channels[1].volume = 8;

			const state = createState(4);
			state.channelCurrentAlpha[0] = 10;
			state.channelCurrentAlpha[1] = 5;
			const result = mixer.merge(registerState, state);

			expect(result.channels[0].tone).toBe(100);
		});

		it('should copy global state (envelope, noise)', () => {
			mixer.configure({ 1: 2 }, 3);
			const registerState = new AYChipRegisterState(4);
			registerState.noise = 15;
			registerState.envelopePeriod = 2000;
			registerState.envelopeShape = 8;
			registerState.forceEnvelopeShapeWrite = true;

			const state = createState(4);
			const result = mixer.merge(registerState, state);

			expect(result.noise).toBe(15);
			expect(result.envelopePeriod).toBe(2000);
			expect(result.envelopeShape).toBe(8);
			expect(result.forceEnvelopeShapeWrite).toBe(true);
		});
	});
});
