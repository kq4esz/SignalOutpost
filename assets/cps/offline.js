// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KQ4ESZ
import { NativeComPort } from "./native-serial.js";

const root = document.documentElement;
try {
	const saved = localStorage.getItem("signal-outpost-theme");
	if (saved === "light" || saved === "dark") root.dataset.theme = saved;
} catch {}
document.querySelector(".theme-toggle")?.addEventListener("click", () => {
	const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
	root.dataset.theme = dark ? "light" : "dark";
	try { localStorage.setItem("signal-outpost-theme", root.dataset.theme); } catch {}
});

const serialStatus = document.getElementById("serial-port-status");
const serialButton = document.getElementById("serial-port-choice");
const serialDialog = document.getElementById("serial-port-dialog");
const serialList = document.getElementById("serial-port-list");
const serialDialogError = document.getElementById("serial-port-dialog-error");
const serialConfirm = document.getElementById("serial-port-confirm");
let discoveredSerialPorts = [];
let nativePortChosen = false;

const showSerialPort = (port) => {
	if (!serialStatus || !port?.getInfo) return;
	const info = port.getInfo();
	const ids = info.usbVendorId == null ? "" : ` · USB ${info.usbVendorId.toString(16).padStart(4, "0").toUpperCase()}:${(info.usbProductId ?? 0).toString(16).padStart(4, "0").toUpperCase()}`;
	const label = window.__signalOutpostSerialLabel || info.portName || "Selected serial port";
	serialStatus.textContent = `${label}${ids}`;
	serialStatus.classList.add("selected");
};

const showSerialDialogError = (message) => {
	if (!serialDialogError) return;
	serialDialogError.textContent = message;
	serialDialogError.hidden = false;
};

const fillSerialList = (ports) => {
	discoveredSerialPorts = [...ports].sort((a, b) => {
		const number = (path) => Number(path.match(/^COM(\d+)$/i)?.[1] || 0);
		return number(a.path) - number(b.path);
	});
	serialList.replaceChildren(...discoveredSerialPorts.map((port) => {
		const option = document.createElement("option");
		option.value = port.path;
		const ids = port.vendorId && port.productId ? `USB ${port.vendorId}:${port.productId}` : "";
		option.textContent = [port.path, port.friendlyName || port.manufacturer, ids].filter(Boolean).join(" — ");
		return option;
	}));
	if (discoveredSerialPorts.length) {
		serialList.selectedIndex = Math.max(0, discoveredSerialPorts.findIndex((port) => port.path.toUpperCase() === "COM4"));
		serialConfirm.disabled = false;
		serialDialogError.hidden = true;
	} else {
		serialConfirm.disabled = true;
		showSerialDialogError("Windows returned no COM ports to the CPS. Check that the port is present in Device Manager, then choose Refresh list.");
	}
};

document.getElementById("serial-port-refresh")?.addEventListener("click", async () => {
	try {
		serialDialogError.textContent = "Reading the Windows COM port list…";
		serialDialogError.hidden = false;
		serialConfirm.disabled = true;
		fillSerialList(await window.signalOutpostNative.listSerialPorts());
	} catch (error) {
		serialConfirm.disabled = true;
		showSerialDialogError(`Could not read Windows COM ports: ${error?.message || error}`);
	}
});

document.getElementById("serial-port-cancel")?.addEventListener("click", () => {
	serialDialog?.close();
	if (serialStatus && !nativePortChosen) serialStatus.textContent = "No port selected";
});

serialConfirm?.addEventListener("click", () => {
	const portInfo = discoveredSerialPorts.find((port) => port.path === serialList.value);
	if (!portInfo) return showSerialDialogError("Select a COM port from the list first.");
	window.__signalOutpostPreferredSerialPort = new NativeComPort(portInfo);
	window.__signalOutpostSerialLabel = portInfo.path;
	nativePortChosen = true;
	showSerialPort(window.__signalOutpostPreferredSerialPort);
	serialDialog.close();
});

window.addEventListener("signal-outpost:serial-port-selected", (event) => {
	window.__signalOutpostSerialLabel = event.detail || "Selected serial port";
	showSerialPort(window.__signalOutpostPreferredSerialPort);
});

serialButton?.addEventListener("click", async () => {
	const serial = navigator.serial;
	if (serialButton) {
		serialButton.disabled = true;
		serialButton.textContent = "Finding ports…";
	}
	if (serialStatus) serialStatus.textContent = window.signalOutpostNative ? "Reading installed Windows COM ports…" : "Opening the browser serial port chooser…";
	try {
		if (window.signalOutpostNative) {
			serialDialogError.hidden = true;
			fillSerialList(await window.signalOutpostNative.listSerialPorts());
			serialDialog.showModal();
		} else if (serial) {
			// Local browser copy fallback. The desktop app uses Windows' native COM list above.
			const port = await serial.requestPort();
			window.__signalOutpostPreferredSerialPort = port;
			window.__signalOutpostSerialLabel = "Selected serial port";
			nativePortChosen = true;
			showSerialPort(port);
		} else {
			if (serialStatus) serialStatus.textContent = "Serial port access is unavailable in this app.";
		}
	} catch (error) {
		if (serialStatus) {
			serialStatus.classList.remove("selected");
			serialStatus.textContent = error?.name === "NotFoundError" && !window.signalOutpostNative
				? "This browser cannot see the cable. Open the installed Signal Outpost CPS to list Windows COM ports."
				: `Port list failed: ${error?.message || error}`;
		}
	} finally {
		if (serialButton) {
			serialButton.disabled = false;
			serialButton.textContent = "Choose COM port";
		}
	}
});

const toolTabs = [...document.querySelectorAll("[data-tool-view]")];
let firmwareLoaded = false;
for (const tab of toolTabs) tab.addEventListener("click", () => {
	const view = tab.dataset.toolView;
	for (const button of toolTabs) {
		const active = button === tab;
		button.classList.toggle("active", active);
		button.setAttribute("aria-selected", String(active));
	}
	const codeplug = document.getElementById("codeplug-view");
	const firmware = document.getElementById("firmware-view");
	codeplug.hidden = view !== "codeplug";
	firmware.hidden = view !== "firmware";
	if (view === "firmware" && !firmwareLoaded) {
		document.getElementById("firmware-frame").src = "./firmware.html?local=1&reporting=0#radio=dm32";
		firmwareLoaded = true;
	}
});
