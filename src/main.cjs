const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { SerialPort } = require('serialport');
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
const nativeSerialPorts = new Map();
const firmwareReleaseAssets = new Map();
const FIRMWARE_RELEASES_API = 'https://api.github.com/repos/kq4esz/SignalOutpost/releases?per_page=100';
const FIRMWARE_RELEASE_BASE = 'https://github.com/kq4esz/SignalOutpost/releases/download/';
const RETIRED_FIRMWARE_IMAGES = new Set([
  'signal-outpost-dm32uv-v26.11.25-blue.bin',
  'rfoundry-dm32-dm32-sstv-aprs-hotspot-sfr-v26.11.25-signal-outpost-blue.bin',
]);
const RETIRED_FIRMWARE_DIGESTS = new Set(['0519b336b43db7b64690febae06392910083f8c78fc7aad78961f26ae37a481d']);

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

function setupNativeSerialAccess() {
  const trusted = (event) => isTrustedAppPage(event.sender);
  ipcMain.handle('signal-outpost:serial-list', async (event) => {
    if (!trusted(event)) throw new Error('Serial access is limited to Signal Outpost CPS.');
    const ports = await SerialPort.list();
    return ports.filter((port) => /^COM\d+$/i.test(port.path || '')).map((port) => ({
      path: port.path,
      friendlyName: port.friendlyName || port.manufacturer || '',
      manufacturer: port.manufacturer || '',
      vendorId: port.vendorId || null,
      productId: port.productId || null,
      serialNumber: port.serialNumber || null,
    }));
  });
  ipcMain.handle('signal-outpost:serial-open', async (event, pathName, baudRate) => {
    if (!trusted(event)) throw new Error('Serial access is limited to Signal Outpost CPS.');
    if (typeof pathName !== 'string' || !/^COM\d+$/i.test(pathName)) throw new Error('Choose a Windows COM port from the CPS list.');
    const listed = await SerialPort.list();
    const portInfo = listed.find((port) => (port.path || '').toUpperCase() === pathName.toUpperCase());
    if (!portInfo) throw new Error(`${pathName} is no longer available. Refresh the COM port list and select it again.`);
    const key = pathName.toUpperCase();
    const existing = nativeSerialPorts.get(key);
    if (existing?.port.isOpen) throw new Error(`${pathName} is already open in the CPS.`);

    const port = new SerialPort({
      path: portInfo.path,
      baudRate: Number(baudRate) || 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      rtscts: false,
      autoOpen: false,
    });
    const sender = event.sender;
    const send = (channel, payload) => {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    };
    nativeSerialPorts.set(key, { port, sender });
    port.on('data', (data) => send('signal-outpost:serial-data', { path: key, data: Uint8Array.from(data) }));
    port.on('error', (error) => send('signal-outpost:serial-error', { path: key, message: error.message || String(error) }));
    port.on('close', () => {
      if (nativeSerialPorts.get(key)?.port === port) nativeSerialPorts.delete(key);
      send('signal-outpost:serial-closed', { path: key });
    });
    try {
      await new Promise((resolve, reject) => port.open((error) => error ? reject(error) : resolve()));
    } catch (error) {
      if (nativeSerialPorts.get(key)?.port === port) nativeSerialPorts.delete(key);
      throw error;
    }
    return { path: portInfo.path };
  });
  ipcMain.handle('signal-outpost:serial-write', async (event, pathName, data) => {
    if (!trusted(event)) throw new Error('Serial access is limited to Signal Outpost CPS.');
    const active = nativeSerialPorts.get(String(pathName).toUpperCase())?.port;
    if (!active?.isOpen) throw new Error(`${pathName} is not open.`);
    const bytes = Buffer.from(data);
    await new Promise((resolve, reject) => active.write(bytes, (error) => {
      if (error) return reject(error);
      active.drain((drainError) => drainError ? reject(drainError) : resolve());
    }));
  });
  ipcMain.handle('signal-outpost:serial-close', async (event, pathName) => {
    if (!trusted(event)) throw new Error('Serial access is limited to Signal Outpost CPS.');
    const key = String(pathName).toUpperCase();
    const active = nativeSerialPorts.get(key)?.port;
    if (!active) return;
    await new Promise((resolve, reject) => active.close((error) => error ? reject(error) : resolve()));
    nativeSerialPorts.delete(key);
  });

  ipcMain.handle('signal-outpost:firmware-list', async (event) => {
    if (!trusted(event)) throw new Error('Firmware release access is limited to Signal Outpost CPS.');
    const response = await fetch(FIRMWARE_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Signal-Outpost-CPS' },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status} while listing firmware releases.`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('GitHub returned an unexpected firmware release list.');

    firmwareReleaseAssets.clear();
    const catalog = [];
    const seenImages = new Set();
    for (const release of releases) {
      if (release.draft || !Array.isArray(release.assets)) continue;
      for (const image of release.assets.filter((asset) => {
        if (!/\.bin$/i.test(asset.name) || !/dm32/i.test(asset.name)) return false;
        const digest = String(asset.digest || '').replace(/^sha256:/i, '').toLowerCase();
        return !RETIRED_FIRMWARE_IMAGES.has(asset.name.toLowerCase()) && !RETIRED_FIRMWARE_DIGESTS.has(digest);
      })) {
        const manifest = release.assets.find((asset) => asset.name.toLowerCase() === image.name.replace(/\.bin$/i, '.json').toLowerCase());
        if (!manifest || image.state !== 'uploaded' || manifest.state !== 'uploaded') continue;
        const identity = image.digest || image.name;
        if (seenImages.has(identity)) continue;
        seenImages.add(identity);

        const assetVersion = /(?:^|[-_])v(\d{2}\.\d{1,2}(?:\.\d+)?)(?:[-_]([^/]+))?\.bin$/i.exec(image.name);
        let name = image.label?.trim() || '';
        if (!name && assetVersion) {
          const variant = (assetVersion[2] || '').replace(/^signal[-_]outpost[-_]?/i, '').replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
          name = `Signal Outpost${variant ? ` ${variant}` : ''} · DM-32UV · v${assetVersion[1]}`;
        }
        if (!name) name = `DM-32UV firmware · ${image.name}`;

        for (const asset of [image, manifest]) {
          let url;
          try { url = new URL(asset.browser_download_url); } catch { continue; }
          if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/kq4esz/SignalOutpost/releases/download/')) continue;
          firmwareReleaseAssets.set(Number(asset.id), { name: asset.name, url: asset.browser_download_url, size: Number(asset.size) || 0 });
        }
        if (!firmwareReleaseAssets.has(Number(image.id)) || !firmwareReleaseAssets.has(Number(manifest.id))) continue;
        catalog.push({
          id: `${release.id}:${image.id}`,
          name,
          imageAssetId: Number(image.id),
          manifestAssetId: Number(manifest.id),
          imageName: image.name,
          manifestName: manifest.name,
          size: Number(image.size) || 0,
          sha256: typeof image.digest === 'string' ? image.digest.replace(/^sha256:/i, '') : '',
          releaseTag: String(release.tag_name || ''),
          publishedAt: String(release.published_at || ''),
        });
      }
    }
    return catalog;
  });

  ipcMain.handle('signal-outpost:firmware-download', async (event, assetId) => {
    if (!trusted(event)) throw new Error('Firmware downloads are limited to Signal Outpost CPS.');
    const id = Number(assetId);
    const asset = Number.isSafeInteger(id) ? firmwareReleaseAssets.get(id) : null;
    if (!asset) throw new Error('This firmware asset is not in the current release list. Refresh the list and choose it again.');
    if (!asset.url.startsWith(FIRMWARE_RELEASE_BASE)) throw new Error('GitHub returned an unexpected firmware download address.');
    if (asset.size > 8 * 1024 * 1024) throw new Error('The selected firmware release asset is larger than the CPS permits.');
    const response = await fetch(asset.url, { headers: { 'User-Agent': 'Signal-Outpost-CPS' } });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status} while downloading ${asset.name}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== asset.size) throw new Error(`${asset.name} downloaded with the wrong size; refresh the release list and try again.`);
    return { name: asset.name, data: bytes };
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
      preload: path.join(__dirname, 'preload.cjs'),
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
  setupNativeSerialAccess();
  setupUpdater();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const { port } of nativeSerialPorts.values()) {
    if (port.isOpen) port.close(() => {});
  }
  nativeSerialPorts.clear();
  if (localServer) localServer.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
