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
	const button = document.getElementById("serial-port-choice");
	const serial = navigator.serial;
	if (!serial) {
		if (serialStatus) serialStatus.textContent = "Web Serial is unavailable in this app build";
		return;
	}
	if (button) {
		button.disabled = true;
		button.textContent = "Choose a port…";
	}
	if (serialStatus) serialStatus.textContent = "Opening the serial port chooser…";
	try {
		// Leave filters empty so unusual USB-serial cable IDs still appear in the system chooser.
		const port = await serial.requestPort();
		window.__signalOutpostPreferredSerialPort = port;
		window.__signalOutpostSerialLabel = "Selected serial port";
		showSerialPort(port);
	} catch (error) {
		if (serialStatus) {
			serialStatus.classList.remove("selected");
			serialStatus.textContent = error?.name === "NotFoundError"
				? "No port selected. If COM3 is available, reconnect the cable and restart CPS."
				: `Port selection failed: ${error?.message || error}`;
		}
	} finally {
		if (button) {
			button.disabled = false;
			button.textContent = "Choose COM port";
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
