import type { Project } from '../../models/project';

export interface RenderOptions {
	separateChannels?: boolean;
}

export interface ChipRenderer {
	render(
		project: Project,
		songIndex: number,
		onProgress?: (progress: number, message: string) => void,
		options?: RenderOptions
	): Promise<Float32Array[]>;
}

