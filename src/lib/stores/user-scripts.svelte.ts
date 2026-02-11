import type { UserScript } from '../services/user-scripts/types';
import { defaultUserScripts } from '../config/user-scripts';

const STORAGE_KEY = 'user-scripts';

function loadFromStorage(): UserScript[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored) as UserScript[];
		}
	} catch (e) {
		console.error('Failed to load user scripts from storage:', e);
	}
	return [];
}

function saveToStorage(scripts: UserScript[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
	} catch (e) {
		console.error('Failed to save user scripts to storage:', e);
	}
}

class UserScriptsStore {
	customScripts = $state<UserScript[]>([]);

	get scripts(): UserScript[] {
		return [...defaultUserScripts, ...this.customScripts];
	}

	get defaultScripts(): UserScript[] {
		return defaultUserScripts;
	}

	init(): void {
		this.customScripts = loadFromStorage();
	}

	isBuiltIn(scriptId: string): boolean {
		return defaultUserScripts.some((s) => s.id === scriptId);
	}

	add(script: UserScript): void {
		const existingIndex = this.customScripts.findIndex((s) => s.id === script.id);
		if (existingIndex >= 0) {
			this.customScripts = [
				...this.customScripts.slice(0, existingIndex),
				script,
				...this.customScripts.slice(existingIndex + 1)
			];
		} else {
			this.customScripts = [...this.customScripts, script];
		}
		saveToStorage(this.customScripts);
	}

	update(script: UserScript): void {
		const index = this.customScripts.findIndex((s) => s.id === script.id);
		if (index >= 0) {
			this.customScripts = [
				...this.customScripts.slice(0, index),
				script,
				...this.customScripts.slice(index + 1)
			];
			saveToStorage(this.customScripts);
		}
	}

	remove(scriptId: string): void {
		this.customScripts = this.customScripts.filter((s) => s.id !== scriptId);
		saveToStorage(this.customScripts);
	}

	exportScript(script: UserScript): string {
		return JSON.stringify(script, null, 2);
	}

	exportAll(): string {
		return JSON.stringify(this.customScripts, null, 2);
	}

	importScript(json: string): UserScript | null {
		try {
			const script = JSON.parse(json) as UserScript;
			if (script.id && script.name && script.code) {
				return script;
			}
		} catch (e) {
			console.error('Failed to parse script JSON:', e);
		}
		return null;
	}

	importAll(json: string): UserScript[] {
		try {
			const scripts = JSON.parse(json) as UserScript[];
			if (Array.isArray(scripts)) {
				return scripts.filter((s) => s.id && s.name && s.code);
			}
		} catch (e) {
			console.error('Failed to parse scripts JSON:', e);
		}
		return [];
	}
}

export const userScriptsStore = new UserScriptsStore();
