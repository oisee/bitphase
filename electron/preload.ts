import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on("menu-action", listener);
    return () => {
      ipcRenderer.removeListener("menu-action", listener);
    };
  },
  setNativeMenu: (enabled: boolean) => {
    ipcRenderer.send("set-native-menu", enabled);
  },
});
