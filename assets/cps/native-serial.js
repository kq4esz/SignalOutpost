// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KQ4ESZ
// Adapts the Electron main-process Windows COM transport to the Web Serial port shape used by the radio tools.

const bridge = () => window.signalOutpostNative;
const usbId = (value) => value == null ? undefined : Number.parseInt(String(value).replace(/^0x/i, ""), 16);

export class NativeComPort {
	constructor(info) {
		this.path = info.path;
		this.info = info;
		this.__signalOutpostNativeSerial = true;
		this.readable = null;
		this.writable = null;
		this.isOpen = false;
		this.closing = false;
		this.controller = null;
		this.unsubscribers = [];
	}

	getInfo() {
		return {
			portName: this.path,
			usbVendorId: usbId(this.info.vendorId),
			usbProductId: usbId(this.info.productId),
			manufacturer: this.info.manufacturer || this.info.friendlyName || "",
		};
	}

	async open({ baudRate = 115200 } = {}) {
		if (this.isOpen) throw new DOMException("The port is already open.", "InvalidStateError");
		const api = bridge();
		if (!api) throw new DOMException("The Windows COM bridge is unavailable.", "NotSupportedError");
		this.closing = false;
		this.readable = new ReadableStream({
			start: (controller) => { this.controller = controller; },
			cancel: () => {},
		}, { highWaterMark: 1 });
		this.writable = new WritableStream({
			write: (data) => api.writeSerialPort(this.path, new Uint8Array(data)),
			abort: () => {},
		});
		this.unsubscribers = [
			api.onSerialData((event) => {
				if (event?.path !== this.path.toUpperCase() || !this.controller || this.closing) return;
				this.controller.enqueue(new Uint8Array(event.data));
			}),
			api.onSerialError((event) => {
				if (event?.path !== this.path.toUpperCase() || this.closing) return;
				this.fail(event.message || "The COM port reported an error.");
			}),
			api.onSerialClosed((event) => {
				if (event?.path !== this.path.toUpperCase() || this.closing) return;
				this.fail("The COM port was disconnected.");
			}),
		];
		try {
			await api.openSerialPort(this.path, baudRate);
			this.isOpen = true;
		} catch (error) {
			this.cleanupListeners();
			this.readable = null;
			this.writable = null;
			this.controller = null;
			throw error;
		}
	}

	fail(message) {
		const controller = this.controller;
		this.controller = null;
		this.readable = null;
		try { controller?.error(new DOMException(message, "NetworkError")); } catch {}
	}

	cleanupListeners() {
		for (const unsubscribe of this.unsubscribers) {
			try { unsubscribe(); } catch {}
		}
		this.unsubscribers = [];
	}

	async close() {
		this.closing = true;
		this.cleanupListeners();
		try { await bridge()?.closeSerialPort(this.path); } finally {
			this.isOpen = false;
			try { this.controller?.close(); } catch {}
			this.controller = null;
			this.readable = null;
			this.writable = null;
		}
	}
}
