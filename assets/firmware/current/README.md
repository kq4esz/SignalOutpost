# Signal Outpost DM-32UV firmware v1.0.0

- Board: Baofeng DM-32UV (`dm32`)
- Firmware version: `v1.0.0`
- Image: `signal-outpost-dm32-v1.0.0.bin`
- Build ID: `b4c6d8b1-dirty`
- Codec: not included; this release contains application firmware only
- Changes: updated digital receive AGC response for testing. Enable **Settings → Sound → Digital RX AGC** on the radio.

This experimental build retains the prior DMR, P25, NXDN, YSF, GPS, GPS sky plot, satellite TLE, APRS, SSTV, hotspot and SFR feature set. The volume overlay remains disabled. D-Star is not included.

The image is intended for an already installed Signal Outpost radio updated through its stub route, which leaves the radio's codec slot intact. A factory update route erases the codec slot; use a codec source from your own stock firmware if the CPS asks for one. No stock firmware or codec binary is included here.

Back up the codeplug first, verify the downloaded image against `SHA256SUMS.txt`, and keep a known-good recovery path available. Real-radio AGC behavior has not yet been confirmed.
