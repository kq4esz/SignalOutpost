# Release notes

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
