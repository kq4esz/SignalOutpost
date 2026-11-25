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