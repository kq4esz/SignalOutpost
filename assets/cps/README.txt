Signal Outpost CPS — offline DM-32UV codeplug programmer

START
1. Install Signal-Outpost-CPS-1.0.5-x64-Setup.exe and open Signal Outpost CPS from the Start menu.
2. Use Choose COM port to select the programming cable from the Windows COM port list. The desktop app can list ports such as COM4 even when Chromium's device picker omits the adapter.
3. Use Read from Radio or Write to Radio for codeplug work, or choose Firmware to install a local DM-32UV image.

The optional Launch-Signal-Outpost-CPS.cmd browser launcher is a Web Serial fallback. Browser security prevents it from listing every Windows COM port; if the cable is missing from the browser chooser, use the installed desktop app.

The CPS works offline. Keep the radio connected only when you are ready to read or write it. Directly opening index.html
with file:// is unsupported. The optional browser launcher uses Web Serial and may not show every Windows COM port;
the installed desktop app uses Windows' native COM port list.

YSF PROGRAMMING
YSF is a selectable conventional channel mode alongside DMR, P25, and NXDN. Enter the channel RX/TX frequencies and
the radio name supplies the source callsign. For a repeater channel, edit the channel and enter the repeater callsign
in Mode parameters > Repeater header callsign (CSD2 downlink/uplink). That fills both repeater callsign fields in the
YSF header and marks frames for repeater routing. Leave it blank for direct/simplex use. This editor build does not
offer per-channel DG-ID or room fields. CSV import/export accepts YSF in the Mode column.

GLOBAL SCAN LIST
Open the Global Scan List tab and choose Add or remove channels to build the list. The DM-32UV supports up to 80
eligible channels in one global list. The Scan key on the radio starts or stops it; it scans in channel-number order,
returns briefly to the parked channel after a call and resumes. All-Channel Scan Skip excludes a selected channel.

FIRMWARE INSTALLATION
The Firmware tab accepts a local .bin image and an optional matching release manifest. It validates the image for the
DM-32UV and flashes it with the C-SKY stub workflow. The radio must be in the state requested by the installer; keep
the battery charged and cable connected throughout the transfer. The CPS does not build firmware or download an image.

OFFLINE LIMITS
DMR ID data can be loaded from a local user.csv or compatible CSV. RadioID web lookup and download links are disabled
in this offline copy. Online error reporting is not part of this CPS bundle.

BRANDING AND LICENSES
The Signal Outpost logo assets are by KQ4ESZ and their GPL-3.0 license is in LICENSES/Signal-Outpost-Branding-GPL-3.0.txt.
The editor source retains its original MIT license and attribution in LICENSES/RadioFoundry-MIT.txt and
LICENSES/RadioFoundry-AUTHORS.txt. No RadioFoundry logo is used in this interface.
