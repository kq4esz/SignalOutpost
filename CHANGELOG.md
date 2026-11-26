# Release notes

## v1.0.8 — Named firmware releases and clearer flash steps

### Added

- Added a GitHub Releases firmware selector to the desktop installer. It lists unique DM-32UV images, downloads the selected image and matching manifest, and verifies the image before flashing.
- Kept local `.bin` images and optional `.json` manifests available.

### Changed

- Replaced raw flash-step translation keys with readable step names.
- Renamed the current firmware asset to `signal-outpost-dm32uv-v26.11.25-blue.bin` and added its display name to the manifest and GitHub release asset label.

## v1.0.7 — Clean up CPS header and intro

### Changed

- Removed the header status pill, redundant feature-availability copy, offline storage note, and offline-copy footer text from the CPS.

## v1.0.6 — Complete GitHub release publishing

### Fixed

- The release workflow now creates or reuses one release and publishes the CPS installer, updater manifest, block map, firmware image, manifest, checksums, and release notes together.
- Added a manual workflow option to rebuild and republish a matching version tag.

## v1.0.5 — Native Windows COM port selection

### Changed

- Replaced the browser device picker in the desktop CPS with a Windows COM port list, including device names and USB adapter details when available.
- Added a native serial transport for the selected COM port so codeplug reads/writes and firmware flashing use the same selected device.
- The chooser preselects COM4 when it is present and lets the user refresh the Windows port list.

## v1.0.4 — Improve COM port discovery

### Fixed

- Disabled Chromium's default Web Serial device blocklist in the desktop CPS so compatible USB-to-serial adapters such as COM3 can appear in the chooser.
- Added an explicit message when Windows exposes no serial ports to the CPS.

## v1.0.3 — Fix COM port chooser

### Fixed

- The COM port chooser now includes serial devices regardless of USB vendor ID, so less common programming cables are not hidden by a filter.
- The CPS shows an opening state and a visible message when the chooser is canceled or no port is selected.

## v1.0.2 — Local firmware installer and COM port selection

### Added

- Added a **Choose COM port** control to the CPS header. The selected serial device is preferred by both codeplug reads/writes and the firmware installer.
- Added a dedicated **Firmware** view with a local DM-32UV `.bin` picker and optional release-manifest verification.
- Bundled the C-SKY stub, DM-32UV flash layout, and codec-map metadata needed for offline firmware installation.
- Firmware flashing uses the existing protected-range checks and RadioFoundry stub flow; it does not request a remote build.

### Notes

- The radio still has to enter the state requested by the installer. Do not disconnect power or the programming cable during a write.
- Firmware compatibility is checked before flashing, but on-air behavior still needs radio testing.

## v1.0.1 — Signal Outpost light blue branding

### Changed

- Recolored the Signal Outpost CPS logo, application icon, and brand wordmark from green to light blue.
- Matched the radio boot logo and wordmark to the same light blue brand color, with a darker blue variant on the light display theme for contrast.
- Kept green receive and status indicators unchanged.

### Firmware

- Rebuilt the DM-32UV test image with the matching light-blue boot logo and wordmark. The image keeps the existing feature set, includes no codec, and uses the stub-entry flashing route.
- Radio operation has not been re-tested with this branding-only build.

## v1.0.0 — Signal Outpost CPS desktop preview

### Added

- Installable Windows desktop CPS with the offline Codeplug Studio, Global Scan List, and YSF repeater header fields.
- Serial-port selection inside the app so programming does not depend on a separate browser or Python server.
- GitHub release checks with a prompt before restarting to install a downloaded CPS update.
- Versioned Windows installer and auto-update metadata on GitHub Releases.
- DM-32UV experimental firmware package, manifest, and SHA-256 checksum as release downloads.

### Firmware status

- Included image: `v26.11.25-ysf-k4gv-repeater` (test build, C-SKY build ID `b4c6d8b1`).
- Conventional YSF repeater header support is included. Repeater operation has not been confirmed on air.
- The image is a stub-entry firmware image and does not include the codec slot.
- See `assets/firmware/current/README.md` and its manifest before flashing.
