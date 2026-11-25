// SPDX-License-Identifier: MIT
// Copyright (c) 2026 The RadioFoundry Authors
// The conventional YSF channel kind in the Codeplug Editor. The optional repeater call is a ten-byte channel tag
// parameter; the radio name supplies the source callsign.

import { grow } from "./modebytes.js";

const CALL_LEN = 10;

function decodeRepeaterCall(b) {
	let value = "";
	for (let i = 0; i < CALL_LEN && i < (b?.length ?? 0); i++) {
		const c = b[i];
		if (c === 0 || c === 0xFF) break;
		value += String.fromCharCode(c);
	}
	return value.replace(/\s+$/, "");
}

function encodeRepeaterCall(p, prev = null) {
	const value = String(p.repeaterCall ?? "").trim().toUpperCase();
	const bytes = grow(prev, CALL_LEN);
	for (let i = 0; i < CALL_LEN; i++) bytes[i] = i < value.length ? value.charCodeAt(i) : 0x20;
	return bytes;
}

export const ysfKind = {
	id: 5,
	feature: "YSF",
	systemType: null,
	contacts: false,
	ownFreqs: true,
	defaultTx: true,
	recordFields: [],
	flags: {},
	newParams: () => ({ repeaterCall: "" }),
	decode: (b) => ({ repeaterCall: decodeRepeaterCall(b) }),
	encode: encodeRepeaterCall,
	fields: () => [{ key: "repeaterCall", label: "editor.ysf.repeater_header_call", type: "text", help: "editor.ysf.repeater_header_call_help" }],
	validate(_c, p, problem) {
		const call = String(p.repeaterCall ?? "").trim();
		if (call !== "" && !/^[A-Za-z0-9/-]{1,10}$/.test(call)) problem.err("repeaterCall", "ysf_repeater_call_invalid");
	},
};
