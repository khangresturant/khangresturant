const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { fork } = require("child_process");
const { printThermalSilent } = require("./printer");

let mainWindow = null;
let serverProcess = null;
let targetUrl = "http://localhost:3000";

// Ensure single instance of the application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/**
 * Checks if a given HTTP URL is up and responding.
 */
function checkServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Polls until the Next.js server is ready before loading the window.
 */
async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await checkServerReady(url);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

/**
 * Starts the embedded Next.js standalone server in production mode.
 */
function startProductionServer(port) {
  const fs = require("fs");
  const { spawn } = require("child_process");
  const appPath = app.getAppPath();
  let serverScript = path.join(appPath, ".next", "standalone", "server.js");
  if (!fs.existsSync(serverScript) && process.resourcesPath) {
    const altPath = path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");
    if (fs.existsSync(altPath)) {
      serverScript = altPath;
    }
  }

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
    NEXT_PUBLIC_USE_LOCAL_SQLITE: "false",
    NEXT_PUBLIC_USE_MOCK: "false",
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    env,
    cwd: path.dirname(serverScript),
    windowsHide: true,
    stdio: "ignore",
  });

  serverProcess.on("error", (err) => {
    console.error("[Electron Server] Failed to spawn server:", err);
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "icon.ico");
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 650,
    title: "Cook Swift",
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      require("electron").shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("get-printers", async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error("[IPC get-printers] Error:", err);
    return [];
  }
});

ipcMain.handle("print-thermal-silent", async (_event, { html, printerName, copies = 1 }) => {
  try {
    const result = await printThermalSilent({ html, printerName, copies });
    return { success: true, printer: result.printer };
  } catch (err) {
    console.error("[IPC print-thermal-silent] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Silent thermal printing failed",
    };
  }
});

ipcMain.handle("get-system-info", async () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    isDesktop: true,
    isPackaged: app.isPackaged,
  };
});

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

  if (isDev) {
    // Development mode: Connect to running Next.js dev server
    targetUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    console.log(`[Electron] Development mode: Connecting to ${targetUrl}...`);
  } else {
    // Production mode: Start embedded server
    const port = 38450;
    targetUrl = `http://127.0.0.1:${port}`;
    console.log(`[Electron] Production mode: Booting embedded server on ${targetUrl}...`);
    startProductionServer(port);
  }

  createMainWindow();

  let isReady = await waitForServer(targetUrl, 25000);
  if (!isReady) {
    // If embedded standalone port didn't answer in time, check if local dev server on 3000 is running
    const devReady = await checkServerReady("http://localhost:3000");
    if (devReady) {
      targetUrl = "http://localhost:3000";
      isReady = true;
    }
  }

  if (isReady && mainWindow) {
    mainWindow.loadURL(targetUrl);
  } else if (mainWindow) {
    dialog.showErrorBox(
      "Server Connection Failed",
      `The desktop application could not connect to the local server at ${targetUrl}. Please ensure the server is running and restart the application.`
    );
  }
});

function cleanupProcess() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // Ignore
    }
    serverProcess = null;
  }
}

app.on("before-quit", cleanupProcess);
app.on("will-quit", cleanupProcess);

app.on("window-all-closed", () => {
  cleanupProcess();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
