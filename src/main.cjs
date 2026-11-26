const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const APP_ID = 'org.signaloutpost.cps';
const HOST = '127.0.0.1';
const PORT = 8776;
const APP_ORIGIN = `http://${HOST}:${PORT}`;

// Programming cables can use USB-serial chipsets on Chromium's default Web Serial blocklist.
// The CPS validates the selected device before opening it, so make those COM ports selectable.
app.commandLine.appendSwitch('disable-serial-blocklist');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

let mainWindow;
let localServer;
let downloadedUpdate = false;
let updateCheckPending = false;

app.setAppUserModelId(APP_ID);

function getCpsDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'cps')
    : path.resolve(__dirname, '..', 'assets', 'cps');
}

function sendFile(response, filePath, method) {
  const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

function startLocalServer() {
  if (localServer?.listening) return Promise.resolve();
  const root = path.resolve(getCpsDirectory());
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error(`CPS files were not found at ${root}`);
  }

  localServer = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, APP_ORIGIN).pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(root, relativePath);
    const relativeTarget = path.relative(root, target);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      response.writeHead(404).end('Not found');
      return;
    }
    if (!stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    sendFile(response, target, request.method);
  });

  return new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(PORT, HOST, () => {
      localServer.removeListener('error', reject);
      resolve();
    });
  });
}

function isTrustedAppPage(contents) {
  if (!contents || !mainWindow || contents !== mainWindow.webContents) return false;
  try {
    return new URL(contents.getURL()).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openAllowedExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && parsed.hostname === '12.255.255.254');
  } catch {
    return false;
  }
}

function setupSerialAccess(window) {
  const session = window.webContents.session;

  session.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
    return ['serial', 'usb'].includes(permission) && contents === window.webContents && requestingOrigin === APP_ORIGIN;
  });
  session.setPermissionRequestHandler((contents, permission, callback) => {
    callback(['serial', 'usb'].includes(permission) && isTrustedAppPage(contents));
  });
  session.on('select-serial-port', (event, ports, contents, callback) => {
    event.preventDefault();
    if (!isTrustedAppPage(contents)) {
      callback('');
      return;
    }

    if (!ports.length) {
      dialog.showMessageBox(window, {
        type: 'warning',
        title: 'No serial ports detected',
        message: 'Signal Outpost CPS did not receive any COM ports from Windows.',
        detail: 'If Device Manager shows COM3, reconnect the cable and restart the CPS. Close any other program currently using the port.',
        buttons: ['OK'],
        noLink: true,
      }).then(() => callback(''), () => callback(''));
      return;
    }

    const labels = ports.map((port) => {
      const description = port.displayName || port.portName || port.manufacturer || 'Serial device';
      const ids = port.vendorId && port.productId ? ` (USB ${port.vendorId}:${port.productId})` : '';
      return `${description}${ids}`;
    });
    const buttons = [...labels, 'Cancel'];
    dialog.showMessageBox(window, {
      type: 'question',
      title: 'Choose radio programming port',
      message: 'Select the programming cable or radio serial port.',
      detail: ports.length ? 'Only the selected serial device is shared with the CPS.' : 'No serial ports are currently available.',
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
      noLink: true,
    }).then(({ response }) => {
      const selected = response >= 0 && response < ports.length ? ports[response] : null;
      callback(selected ? selected.portId : '');
      if (selected) {
        const label = selected.portName || selected.displayName || selected.manufacturer || 'Selected serial port';
        const event = `window.dispatchEvent(new CustomEvent('signal-outpost:serial-port-selected',{detail:${JSON.stringify(label)}}))`;
        contents.executeJavaScript(event).catch(() => {});
      }
    }).catch(() => callback(''));
  });
  session.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    if (!isTrustedAppPage(window.webContents)) {
      callback('');
      return;
    }
    const devices = details.deviceList || [];
    const labels = devices.map((device) => {
      const description = device.productName || device.name || 'USB device';
      const ids = device.vendorId != null && device.productId != null
        ? ` (USB ${device.vendorId}:${device.productId})`
        : '';
      return `${description}${ids}`;
    });
    const buttons = [...labels, 'Cancel'];
    dialog.showMessageBox(window, {
      type: 'question',
      title: 'Choose radio USB device',
      message: 'Select the radio or USB device for this operation.',
      detail: devices.length ? 'Only the selected USB device is shared with the CPS.' : 'No USB devices are currently available.',
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
      noLink: true,
    }).then(({ response }) => {
      const selected = response >= 0 && response < devices.length ? devices[response] : null;
      callback(selected ? selected.deviceId : '');
    }).catch(() => callback(''));
  });
}

function setApplicationMenu(window) {
  const template = [
    {
      label: 'Signal Outpost CPS',
      submenu: [
        { label: 'About Signal Outpost CPS', role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => checkForUpdates(true),
        },
        {
          label: 'Restart to Install Update',
          enabled: false,
          id: 'install-update',
          click: () => autoUpdater.quitAndInstall(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Signal Outpost on GitHub',
          click: () => shell.openExternal('https://github.com/kq4esz/SignalOutpost'),
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

function updateMenuState() {
  const menu = Menu.getApplicationMenu();
  const item = menu?.getMenuItemById('install-update');
  if (item) item.enabled = downloadedUpdate;
}

function checkForUpdates(showResult) {
  if (!app.isPackaged) {
    if (showResult && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Updates are checked in the installed application.',
        buttons: ['OK'],
      });
    }
    return;
  }
  if (updateCheckPending || downloadedUpdate) return;
  updateCheckPending = true;
  autoUpdater.checkForUpdates().then((result) => {
    if (showResult && result && !result.updateInfo?.version) {
      dialog.showMessageBox(mainWindow, { type: 'info', message: 'No update information was returned.', buttons: ['OK'] });
    } else if (showResult && result && result.updateInfo?.version === app.getVersion()) {
      dialog.showMessageBox(mainWindow, { type: 'info', message: 'Signal Outpost CPS is up to date.', buttons: ['OK'] });
    }
  }).catch((error) => {
    console.warn('Update check failed:', error.message);
    if (showResult && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        message: 'Could not check for updates.',
        detail: error.message,
        buttons: ['OK'],
      });
    }
  }).finally(() => { updateCheckPending = false; });
}

function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('error', (error) => console.warn('Updater error:', error.message));
  autoUpdater.on('update-downloaded', async (event) => {
    downloadedUpdate = true;
    updateMenuState();
    if (!mainWindow) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: `Signal Outpost CPS ${event.version || ''} is ready to install.`,
      detail: 'The update will be installed after the CPS closes and restarts.',
      buttons: ['Restart and install', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  if (app.isPackaged && !process.argv.includes('--squirrel-firstrun')) {
    setTimeout(() => checkForUpdates(false), 10000);
    setInterval(() => checkForUpdates(false), 6 * 60 * 60 * 1000);
  }
}

async function createWindow() {
  try {
    await startLocalServer();
  } catch (error) {
    const occupied = error.code === 'EADDRINUSE';
    await dialog.showMessageBox({
      type: 'error',
      title: 'Signal Outpost CPS could not start',
      message: occupied ? `Port ${PORT} is already in use.` : 'The CPS files could not be opened.',
      detail: occupied
        ? 'Close any older Signal Outpost CPS launcher or local CPS server, then start this app again.'
        : error.message,
      buttons: ['OK'],
    });
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    title: 'Signal Outpost CPS',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  setApplicationMenu(mainWindow);
  setupSerialAccess(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (openAllowedExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      event.preventDefault();
      if (openAllowedExternal(url)) shell.openExternal(url);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(`${APP_ORIGIN}/`);
  if (process.argv.includes('--devtools')) mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  setupUpdater();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (localServer) localServer.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
