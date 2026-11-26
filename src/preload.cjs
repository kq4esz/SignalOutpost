const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') throw new TypeError('A callback is required.');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('signalOutpostNative', Object.freeze({
  listSerialPorts: () => ipcRenderer.invoke('signal-outpost:serial-list'),
  listFirmwareReleases: () => ipcRenderer.invoke('signal-outpost:firmware-list'),
  downloadFirmwareAsset: (assetId) => ipcRenderer.invoke('signal-outpost:firmware-download', assetId),
  openSerialPort: (path, baudRate) => ipcRenderer.invoke('signal-outpost:serial-open', path, baudRate),
  writeSerialPort: (path, data) => ipcRenderer.invoke('signal-outpost:serial-write', path, data),
  closeSerialPort: (path) => ipcRenderer.invoke('signal-outpost:serial-close', path),
  onSerialData: (callback) => subscribe('signal-outpost:serial-data', callback),
  onSerialError: (callback) => subscribe('signal-outpost:serial-error', callback),
  onSerialClosed: (callback) => subscribe('signal-outpost:serial-closed', callback),
}));
