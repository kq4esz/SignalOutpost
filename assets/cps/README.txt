Signal Outpost CPS — offline DM-32UV codeplug programmer

START
1. Double-click Launch-Signal-Outpost-CPS.cmd.
2. Open the page in Chrome or Edge at http://127.0.0.1:8776/.
3. Connect the programming cable or radio USB serial port, then use Read from Radio or Write to Radio.
4. Close the local server window when finished.

The page and programming code are served from this folder. It does not need an Internet connection. Keep the radio
connected only when you are ready to read or write it. Directly opening index.html with file:// will not allow the
browser's Web Serial API; use the launcher and localhost instead.

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

OFFLINE LIMITS
DMR ID data can be loaded from a local user.csv or compatible CSV. RadioID web lookup and download links are disabled
in this offline copy. Firmware updates and online error reporting are not part of this CPS bundle.

BRANDING AND LICENSES
The Signal Outpost logo assets are by KQ4ESZ and their GPL-3.0 license is in LICENSES/Signal-Outpost-Branding-GPL-3.0.txt.
The editor source retains its original MIT license and attribution in LICENSES/RadioFoundry-MIT.txt and
LICENSES/RadioFoundry-AUTHORS.txt. No RadioFoundry logo is used in this interface.