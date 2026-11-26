# Current DM-32UV firmware test image

- Board: Baofeng DM-32UV (`dm32`)
- Firmware version: `v26.11.25-signal-outpost-blue`
- Build ID: `b4c6d8b1-dirty` (local Signal Outpost branding update)
- Image: `rfoundry-dm32-dm32-sstv-aprs-hotspot-sfr-v26.11.25-signal-outpost-blue.bin`
- Image size: 707,524 bytes
- Image SHA-256: `0519b336b43db7b64690febae06392910083f8c78fc7aad78961f26ae37a481d`
- Flashing route: RadioFoundry stub entry
- Codec image: not included

This is an experimental test build. The Signal Outpost boot logo and wordmark use light blue brand colors. No radio behavior was intentionally changed. The build retains DMR, P25, NXDN, YSF, GPS, GPS sky plot, satellite TLE, APRS, SSTV, hotspot and SFR features listed in the JSON manifest. Conventional YSF repeater operation remains unconfirmed.

Before flashing, confirm the radio model is DM-32UV, save a codeplug backup, and compare the downloaded image's SHA-256 with `SHA256SUMS.txt`. Use the stub-entry flashing route supported by the RadioFoundry flasher. Do not use the stock update route for this image. Keep a known-good recovery image and programming cable available.

This release contains no stock firmware dump and no AMBE codec binary. Follow the included firmware and application license notices when redistributing the image.
