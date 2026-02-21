import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { ResourceLoader } from '../src/lib/chips/base/resource-loader';

export class FileSystemResourceLoader implements ResourceLoader {
	private basePath: string;

	constructor(basePath: string) {
		this.basePath = basePath;
	}

	async loadWasm(url: string): Promise<ArrayBuffer> {
		const filePath = path.join(this.basePath, url);
		const buffer = fs.readFileSync(filePath);
		return buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		) as ArrayBuffer;
	}

	async loadModule<T = Record<string, unknown>>(url: string): Promise<T> {
		const filePath = path.join(this.basePath, url);
		const urlString = pathToFileURL(filePath).href;
		return import(urlString) as Promise<T>;
	}
}
