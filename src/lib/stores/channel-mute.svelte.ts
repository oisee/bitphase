type ChannelMuteState = Map<number, boolean[]>;

class ChannelMuteStore {
	muteState: ChannelMuteState = $state(new Map());

	private ensureChipMutes(chipIndex: number): boolean[] {
		if (!this.muteState.has(chipIndex)) {
			this.muteState.set(chipIndex, []);
		}
		return this.muteState.get(chipIndex)!;
	}

	isChannelMuted(chipIndex: number, channelIndex: number): boolean {
		const chipMutes = this.muteState.get(chipIndex);
		return chipMutes ? (chipMutes[channelIndex] ?? false) : false;
	}

	toggleChannel(chipIndex: number, channelIndex: number): void {
		const chipMutes = this.ensureChipMutes(chipIndex);
		chipMutes[channelIndex] = !(chipMutes[channelIndex] ?? false);
		this.muteState = new Map(this.muteState);
	}

	setChannelMuted(chipIndex: number, channelIndex: number, muted: boolean): void {
		const chipMutes = this.ensureChipMutes(chipIndex);
		chipMutes[channelIndex] = muted;
		this.muteState = new Map(this.muteState);
	}

	getAllMuteStates(): ChannelMuteState {
		return new Map(this.muteState);
	}
}

export const channelMuteStore = new ChannelMuteStore();
