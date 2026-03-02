import { Clip } from '../models/clip';

class ClipStore {
	clips = $state<Clip[]>([]);

	addClip(clip: Clip): void {
		this.clips = [...this.clips, clip];
	}

	removeClip(id: string): void {
		this.clips = this.clips.filter((c) => c.id !== id);
	}

	getClip(id: string): Clip | undefined {
		return this.clips.find((c) => c.id === id);
	}

	renameClip(id: string, name: string): void {
		const clip = this.clips.find((c) => c.id === id);
		if (clip) {
			clip.name = name;
			this.clips = [...this.clips];
		}
	}

	clear(): void {
		this.clips = [];
	}

	loadClips(clips: Clip[]): void {
		this.clips = clips;
	}
}

export const clipStore = new ClipStore();
