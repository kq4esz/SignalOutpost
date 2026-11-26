# Signal Outpost CPS

Signal Outpost CPS is an offline Windows desktop app for programming the Baofeng DM-32UV codeplug. It packages the
Signal Outpost branded CPS bundle and opens it in a desktop window. Radio programming remains local to the PC and
uses the selected USB serial programming cable.

## Download

Download the Windows installer from the [GitHub Releases page](https://github.com/kq4esz/SignalOutpost/releases). The
same release includes the current DM-32UV firmware image, manifest, checksum, and flashing notes.

## Install and use

1. Run `Signal-Outpost-CPS-1.0.9-x64-Setup.exe` and complete the installer.
2. Open **Signal Outpost CPS** from the Start menu or desktop.
3. Connect the DM-32UV programming cable and use **Choose COM port** in the CPS header to select it from Windows' installed COM port list.
4. Use **Read from Radio** or **Write to Radio** for codeplug programming, or open **Firmware** to select a GitHub firmware release or local image.

Codeplug editing and radio programming work offline; codeplug data stays in this computer's app storage and is sent to
the radio only when you choose a read or write operation. Internet access is needed to check CPS updates or list and
download published firmware. Firmware flashing is a separate user-started operation in the **Firmware** section; the
selected image is checked locally and is never fetched from a build service.

## Firmware distribution

The current test firmware is kept in `assets/firmware/current/` with its release manifest and SHA-256 file. Firmware
files attached to public GitHub releases appear in the Firmware version list, grouped by unique image. The current
image is named **Signal Outpost Blue — DM-32UV — v26.11.25** and requires the RadioFoundry stub route. Local `.bin`
files with a matching `.json` manifest remain supported. New firmware packages use the name format
`signal-outpost-dm32uv-v<radio-version>-<variant>.bin`; the matching manifest sets `display_name` for the CPS picker.

## Publish a version

1. Update the CPS files in `assets/cps/` and, when a new radio build is ready, replace the files in
   `assets/firmware/current/` together (image, manifest, checksums, and firmware README).
2. Set the new semantic version in `package.json` and add a matching `## vX.Y.Z` entry to `CHANGELOG.md`.
3. Commit and push those changes to `main`.
4. Create and push the matching tag, for example `git tag v1.0.1` followed by `git push origin v1.0.1`.
5. GitHub Actions builds the Windows NSIS installer, publishes the updater manifest and installer, and attaches the
   firmware files with the release notes.

The tag must match `package.json`. Installed apps use the GitHub release's generated `latest.yml` file to find CPS
updates. Keep versioned firmware binaries in GitHub Releases so the source history remains small and reviewable.

## Local development

Requires Node.js 24 and pnpm 11.25 or later.

```powershell
pnpm install
pnpm start
pnpm dist
```

The app serves its offline CPS bundle at `127.0.0.1:8776` so the browser storage origin stays stable between launches.
Close the older local CPS launcher if the desktop app reports that the port is already in use.

## Licensing

The Signal Outpost application and firmware modifications are distributed under GPL-3.0; included RadioFoundry CPS
source retains its MIT license and author notices. Third-party notices and license texts are in `LICENSES/` and the
offline CPS bundle's `LICENSES/` folder. Signal Outpost brand assets are under the included GPL-3.0 branding license.

The Windows installer is not code-signed in this preview. Windows may display a SmartScreen publisher warning until
the project uses a code-signing certificate.
