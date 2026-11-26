// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KQ4ESZ
// Reuse the offline CPS's embedded language catalog; this page never loads the online flasher or a remote build.
const response = await fetch("./index.html");
if (!response.ok) throw new Error(`Could not load the local CPS language catalog (${response.status})`);
const source = await response.text();
const page = new DOMParser().parseFromString(source, "text/html");
const catalog = page.getElementById("i18n");
if (!catalog) throw new Error("The local CPS language catalog is missing");
document.body.append(catalog.cloneNode(true));
await import("./static/js/flasher/app.js");
