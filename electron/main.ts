import { app, BrowserWindow, Menu, ipcMain, protocol, net } from "electron";
import path from "path";
import { pathToFileURL } from "url";

const DIST = path.join(app.getAppPath(), "dist");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const isMac = process.platform === "darwin";

function sendMenuAction(win: BrowserWindow | null, action: string) {
  win?.webContents.send("menu-action", action);
}

function buildNativeMenu(win: BrowserWindow | null): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction(win, "new-project"),
        },
        {
          label: "New Song (AY/YM)",
          click: () => sendMenuAction(win, "new-song-ay"),
        },
        { type: "separator" },
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction(win, "open"),
        },
        {
          label: "Import Module",
          click: () => sendMenuAction(win, "import-module"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction(win, "save"),
        },
        { type: "separator" },
        {
          label: "Export WAV",
          click: () => sendMenuAction(win, "export-wav"),
        },
        {
          label: "Export PSG",
          click: () => sendMenuAction(win, "export-psg"),
        },
        { type: "separator" },
        ...(isMac
          ? [{ role: "close" as const }]
          : [{ role: "quit" as const }]),
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => sendMenuAction(win, "undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () => sendMenuAction(win, "redo"),
        },
        { type: "separator" },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          click: () => sendMenuAction(win, "copy"),
        },
        {
          label: "Cut",
          accelerator: "CmdOrCtrl+X",
          click: () => sendMenuAction(win, "cut"),
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          click: () => sendMenuAction(win, "paste"),
        },
        {
          label: "Magic Paste",
          accelerator: "CmdOrCtrl+Shift+V",
          click: () => sendMenuAction(win, "paste-without-erasing"),
        },
        { type: "separator" },
        {
          label: "Increment Value",
          click: () => sendMenuAction(win, "increment-value"),
        },
        {
          label: "Decrement Value",
          click: () => sendMenuAction(win, "decrement-value"),
        },
        { type: "separator" },
        {
          label: "Transpose Octave Up",
          click: () => sendMenuAction(win, "transpose-octave-up"),
        },
        {
          label: "Transpose Octave Down",
          click: () => sendMenuAction(win, "transpose-octave-down"),
        },
        {
          label: "Swap Channels Left",
          click: () => sendMenuAction(win, "swap-channel-left"),
        },
        {
          label: "Swap Channels Right",
          click: () => sendMenuAction(win, "swap-channel-right"),
        },
        { type: "separator" },
        {
          label: "Apply Script...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction(win, "apply-script"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Appearance",
          click: () => sendMenuAction(win, "appearance"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Settings",
      click: () => sendMenuAction(win, "settings"),
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Effects",
          click: () => sendMenuAction(win, "effects"),
        },
        {
          label: "About",
          click: () => sendMenuAction(win, "about"),
        },
      ],
    },
  ];

  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  return Menu.buildFromTemplate(template);
}

let nativeMenu: Menu | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#09090b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  nativeMenu = buildNativeMenu(win);

  Menu.setApplicationMenu(null);

  win.loadURL("app://-/");
}

app.on("ready", () => {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const filePath =
      url.pathname === "/"
        ? path.join(DIST, "index.html")
        : path.join(DIST, url.pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  ipcMain.on("set-native-menu", (_event, enabled: boolean) => {
    Menu.setApplicationMenu(enabled ? nativeMenu : null);
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
