# Current DM-32UV firmware test image

- Board: Baofeng DM-32UV (`dm32`)
- Firmware version: `v26.11.25-ysf-k4gv-repeater`
- Build ID: `b4c6d8b1`
- Image: `rfoundry-dm32-dm32-sstv-aprs-hotspot-sfr-v26.11.25-ysf-k4gv-repeater.bin`
- Image size: 707,468 bytes
- Image SHA-256: `31e425600b5e8de7db568b497158dddc782f5a4454536417627b2436421365cf`
- Flashing route: RadioFoundry stub entry
- Codec image: not included

This is an experimental test build. It includes conventional YSF repeater header support, but operation with the
K4GV repeater has not been confirmed. The image retains DMR, P25, NXDN and YSF modes and includes the other features
listed in the JSON manifest.

Before flashing, confirm that the radio is a DM-32UV, save a codeplug backup, and compare the downloaded image's
SHA-256 with `SHA256SUMS.txt`. Use the stub-entry flashing route supported by the RadioFoundry flasher. Do not use
the stock update route for this image. Keep a known-good recovery image and programming cable available.

This release contains no stock firmware dump and no AMBE codec binary. Follow the included firmware and application
license notices when redistributing the image.
