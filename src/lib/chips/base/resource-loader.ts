export interface ResourceLoader {
	loadWasm(url: string): Promise<ArrayBuffer>;
	loadModule<T = Record<string, unknown>>(url: string): Promise<T>;
}

export class BrowserResourceLoader implements ResourceLoader {
	private baseUrl: string;

	constructor(baseUrl = import.meta.env.BASE_URL || '/') {
		this.baseUrl = baseUrl;
	}

	async loadWasm(url: string): Promise<ArrayBuffer> {
		const response = await fetch(this.baseUrl + url);
		return response.arrayBuffer();
	}

	async loadModule<T = Record<string, unknown>>(url: string): Promise<T> {
		return import(/* @vite-ignore */ this.baseUrl + url) as Promise<T>;
	}
}
