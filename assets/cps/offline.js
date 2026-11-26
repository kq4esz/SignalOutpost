// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KQ4ESZ
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
const showSerialPort = (port) => {
	if (!serialStatus || !port?.getInfo) return;
	const info = port.getInfo();
	const ids = info.usbVendorId == null ? "" : ` · USB ${info.usbVendorId.toString(16).padStart(4, "0").toUpperCase()}:${(info.usbProductId ?? 0).toString(16).padStart(4, "0").toUpperCase()}`;
	const label = window.__signalOutpostSerialLabel || "Selected serial port";
	serialStatus.textContent = `${label}${ids}`;
	serialStatus.classList.add("selected");
};

window.addEventListener("signal-outpost:serial-port-selected", (event) => {
	window.__signalOutpostSerialLabel = event.detail || "Selected serial port";
	showSerialPort(window.__signalOutpostPreferredSerialPort);
});

document.getElementById("serial-port-choice")?.addEventListener("click", async () => {
	const serial = navigator.serial;
	if (!serial) {
		if (serialStatus) serialStatus.textContent = "Web Serial is unavailable in this app build";
		return;
	}
	try {
		// These cover the DM-32UV USB radio and common FTDI, CH340, CP210x and PL2303 programming cables.
		const filters = [
			{ usbVendorId: 0x1FC9, usbProductId: 0x0094 },
			...([0x0403, 0x1A86, 0x10C4, 0x067B].map((usbVendorId) => ({ usbVendorId }))),
		];
		const port = await serial.requestPort({ filters });
		window.__signalOutpostPreferredSerialPort = port;
		showSerialPort(port);
	} catch (error) {
		if (error?.name !== "NotFoundError" && serialStatus) serialStatus.textContent = `Port selection failed: ${error?.message || error}`;
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
