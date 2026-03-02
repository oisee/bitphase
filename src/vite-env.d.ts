/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/svelte" />

interface ElectronAPI {
	isElectron: true;
	onMenuAction: (callback: (action: string) => void) => () => void;
	setNativeMenu: (enabled: boolean) => void;
}

interface Window {
	electronAPI?: ElectronAPI;
}
