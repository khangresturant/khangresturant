const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const { printThermalSilent } = require("./printer");

let mainWindow = null;

// Production Cloud URL (Vercel deployment connected to Neon PostgreSQL)
const CLOUD_URL = process.env.COOK_SWIFT_CLOUD_URL || "https://khangresturant.falconswift.online";
const LOCAL_DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";

// Ensure single instance of the POS desktop application
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
 * Checks if a remote or local URL is responsive.
 */
function checkUrlReady(urlStr, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === "https:" ? https : http;
      const req = client.get(
        urlStr,
        {
          timeout: timeoutMs,
          headers: { "User-Agent": "CookSwift-Desktop/0.1.0" },
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Generates the offline connection retry page HTML.
 */
function getOfflineHtml(targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Khan G Restaurant - Connecting...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px;
      max-width: 520px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      font-weight: 600;
      font-size: 13px;
      border-radius: 9999px;
      margin-bottom: 20px;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .url-chip {
      background: #0f172a;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      color: #38bdf8;
      display: block;
      margin: 10px 0 20px;
      word-break: break-all;
      border: 1px solid #1e293b;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #334155;
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn-group {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 20px;
    }
    button {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: #f59e0b;
      color: #0f172a;
    }
    .btn-primary:hover {
      background: #d97706;
    }
    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .timer {
      font-size: 12px;
      color: #64748b;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div class="badge">Cook Swift POS Desktop</div>
    <h1>Connecting to Cloud Server</h1>
    <p>Connecting to Khan G Restaurant system (Vercel &amp; Neon DB)...</p>
    <div class="url-chip">${targetUrl}</div>
    <div class="btn-group">
      <button class="btn-primary" onclick="retryNow()">Retry Now</button>
      <button class="btn-secondary" onclick="tryLocal()">Connect Local (Port 3000)</button>
    </div>
    <div class="timer" id="timer">Auto-retrying in <span id="countdown">4</span>s...</div>
  </div>

  <script>
    let seconds = 4;
    const target = ${JSON.stringify(targetUrl)};
    const cdEl = document.getElementById("countdown");

    function retryNow() {
      window.location.href = target;
    }

    function tryLocal() {
      window.location.href = "http://localhost:3000";
    }

    const interval = setInterval(() => {
      seconds--;
      if (cdEl) cdEl.innerText = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        window.location.href = target;
      }
    }, 1000);
  </script>
</body>
</html>`;
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "icon.ico");
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 650,
    title: "Cook Swift - Khan G Restaurant",
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
    if (
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {
      if (!url.includes("khangresturant.falconswift.online") && !url.includes("localhost")) {
        require("electron").shell.openExternal(url);
        return { action: "deny" };
      }
    }
    return { action: "allow" };
  });

  // Handle load failure gracefully by showing offline retry screen
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    // Ignore canceled navigation aborts
    if (errorCode === -3) return;
    console.warn(`[Electron] Page failed to load (${errorCode}): ${errorDescription} on ${validatedURL}`);
    const offlineDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
      getOfflineHtml(CLOUD_URL)
    )}`;
    mainWindow?.loadURL(offlineDataUrl);
  });
}

// ── POS Desktop Keyboard Shortcuts ──────────────────────────────────────────
function registerShortcuts() {
  // F5 or Ctrl+R for reloading the POS
  globalShortcut.register("F5", () => {
    if (mainWindow && mainWindow.isFocused()) {
      mainWindow.webContents.reload();
    }
  });
  globalShortcut.register("CommandOrControl+R", () => {
    if (mainWindow && mainWindow.isFocused()) {
      mainWindow.webContents.reload();
    }
  });
  // F11 for Fullscreen toggle
  globalShortcut.register("F11", () => {
    if (mainWindow && mainWindow.isFocused()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  // Ctrl+Shift+I for DevTools (debugging)
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow && mainWindow.isFocused()) {
      mainWindow.webContents.toggleDevTools();
    }
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
    cloudUrl: CLOUD_URL,
  };
});

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createMainWindow();
  registerShortcuts();

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

  let finalUrl = CLOUD_URL;

  if (isDev) {
    // In local dev, check if localhost:3000 is running
    const devReady = await checkUrlReady(LOCAL_DEV_URL, 1500);
    if (devReady) {
      finalUrl = LOCAL_DEV_URL;
      console.log(`[Electron Dev] Connected to local server: ${finalUrl}`);
    } else {
      console.log(`[Electron Dev] Local server not active; linking to live Vercel cloud: ${finalUrl}`);
    }
  } else {
    // In production desktop app: Check if live Vercel cloud is reachable
    console.log(`[Electron Prod] Connecting to Khan G Restaurant Cloud (Vercel & Neon DB): ${finalUrl}...`);
    const isCloudReady = await checkUrlReady(CLOUD_URL, 5000);
    if (!isCloudReady) {
      console.warn(`[Electron Prod] Cloud server not reachable, checking localhost fallback...`);
      const isLocalReady = await checkUrlReady("http://localhost:3000", 1500);
      if (isLocalReady) {
        finalUrl = "http://localhost:3000";
      } else {
        // Load offline auto-reconnecting screen
        finalUrl = `data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml(CLOUD_URL))}`;
      }
    }
  }

  if (mainWindow) {
    mainWindow.loadURL(finalUrl);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
