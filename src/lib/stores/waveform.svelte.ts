const WAVEFORM_FRAME_SIZE = 512;
const WAVEFORM_DISPLAY_LENGTH = 1536;

class WaveformStore {
	private channelDataByChip: Float32Array[][] = $state([]);
	private writeIndexByChip: number[] = $state([]);

	get channels(): Float32Array[] {
		return this.channelDataByChip.flatMap((chipBuffers, chipIndex) => {
			const writeIndex = this.writeIndexByChip[chipIndex] ?? 0;
			return chipBuffers.map((buf) => {
				const out = new Float32Array(buf.length);
				for (let i = 0; i < buf.length; i++) {
					out[i] = buf[(writeIndex + i) % buf.length];
				}
				return out;
			});
		});
	}

	setChannels(chipIndex: number, channels: Float32Array[]): void {
		while (this.channelDataByChip.length <= chipIndex) {
			this.channelDataByChip = [...this.channelDataByChip, []];
			this.writeIndexByChip = [...this.writeIndexByChip, 0];
		}
		const ringSize = WAVEFORM_DISPLAY_LENGTH;
		let writeIndex = this.writeIndexByChip[chipIndex] ?? 0;
		const existing = this.channelDataByChip[chipIndex];
		const newBuffers = channels.map((buf, ch) => {
			const ring =
				existing[ch]?.length === ringSize ? existing[ch] : new Float32Array(ringSize);
			for (let i = 0; i < buf.length; i++) {
				ring[(writeIndex + i) % ringSize] = buf[i];
			}
			return ring;
		});
		writeIndex = (writeIndex + WAVEFORM_FRAME_SIZE) % ringSize;
		this.channelDataByChip = this.channelDataByChip.slice();
		this.channelDataByChip[chipIndex] = newBuffers;
		this.writeIndexByChip = this.writeIndexByChip.slice();
		this.writeIndexByChip[chipIndex] = writeIndex;
	}

	clear(): void {
		this.channelDataByChip = [];
		this.writeIndexByChip = [];
	}
}

export const waveformStore = new WaveformStore();
