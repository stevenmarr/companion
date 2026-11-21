## Performance Video Control Center

![Performance Video](icon.png)

Puts **Performance Video Control Center** on your Stream Decks: the buttons and pages you build in Control Center, and
the live deck pages Control Center draws (HOME, PTZ, ATEM, CONSOLE) with the + / + XL knobs and touch strips.
**Every command goes through the Control Center app** (default port 8080); this module never talks to a device.

**Config:** the Mac running Control Center (host / IP) and its port, the update mode (long-poll by default, poll only
as an option) and the poll interval, **E2 / PixelHue / ATEM / PTZ** on / off, **Control Center deck pages for** (which
Stream Deck sizes get deck pages, default Stream Deck + XL) and **PTZ max hold** (a held motion stops by itself after
this long, default 20 s).

### Control Center buttons and pages (Control Center 0.31.0 or newer)

The **BUTTONS** and **PAGES** tabs in Control Center define the buttons; Companion puts them on Stream Decks. Presets:
**CC buttons** (one per button) and **CC page: <name> (<surface>)** (keys, then the + / + XL touch strip, then the
knobs). Drag them onto a page, or lay them out with the fork's page designs and templates.

- **Action** *Control Center: run a CC button* (`cc_button_run`): button, event (press / release / hold / turn / push /
  touch) and a knob delta (variables allowed). Control Center runs the button's own actions.
- **Feedback** *Control Center: look of a CC button* (`cc_button_look`): the button's text and colours from Control Center.
- **Variables:** `$(pvcc:cc_buttons_rev)`, `$(pvcc:cc_button_count)`, `$(pvcc:cc_page_count)`.

An edit in Control Center, or **SYNC TO COMPANION** on its COMPANION tab, republishes the presets within a few seconds.
The COMPANION tab can also download a page as a `.companionconfig` for Companion's Import / Export.

### Control Center deck pages and touch strips (Control Center 0.32.0 or newer)

- **CC deck: Stream Deck + XL (whole deck, follows HOME and page keys)**: every key, strip cell and knob of one Control
  Center deck. Put them on one Companion page in the same rows and columns (strip cells on the row under the keys,
  knobs on the row under that). HOME, PTZ, a page key or SHIFT work like on a USB deck.
- **CC deck: Stream Deck + XL · <page> [ptz.0]**: one page that stays put. Easiest: Control Center → COMPANION → DECK
  PAGES → download the page's `.companionconfig`, then Import / Export → Import here and map "cc" to this connection.
- **CC deck: touch-strip displays and knobs**: each PTZ dial (R / B gain, R / B pedestal, iris, master pedestal,
  detail, gamma, chroma, knee, zoom, focus, speeds) on its own, for the selected camera. Put the display in a strip
  cell and the knob in the cell under it. A knob push switches a pair (R ↔ B); a long push resets.
- Actions `cc_deck_key`, `cc_deck_dial`, `cc_dial_widget`; feedbacks `cc_deck_look`, `cc_dial_look`.
- Variables: `$(pvcc:cc_strip_plusxl_3)` (a knob's readout), `$(pvcc:cc_dial_gainRb)`, `$(pvcc:cc_deck_plusxl_page)`.
- If Control Center's COMPANION tab says "0 deck presets", open this connection, set **Control Center deck pages for**
  (for example Stream Deck + XL), Save, then press SYNC on the COMPANION tab.

Companion has no separate encoder screen: on a + / + XL the strip is a row of buttons, each cell drawn from its button.

The presets list only these **CC deck** and **CC** sections.

### Actions and feedbacks for the systems Control Center drives

These send each command to Control Center, which drives the device. Use them on your own buttons when a CC button
does not cover it. Remove any direct E2 / ATEM / Panasonic connections from Companion once your buttons use this
module, so there is one path to each device.

**Analog Way Aquilon RS6.** Actions: recall preset to Preview (dropdown of Control Center's presets, including
combined ones, e.g. `10 Panel Master + MV (M:3 S4:30 MV1:2)`); load a Screen, Master or Multiviewer memory (a Master
memory load also selects the screens stored for that master, so TAKE / CUT follow it); re-import memories; TAKE; CUT;
toggle destination; auto take; input freeze; backup slot (primary / backup 1 / backup 2 for an input, a background set
written `S1/2`, or a backup group) and backup mode; audio channel mute. Feedbacks: preset on Preview (green) / Program
(red), destination selected, auto take on, device connected, input on Program / Preview (from the device), destination
last Screen memory is X, last Master memory is X, input frozen, input unavailable or disabled, backup active, audio
channel muted.

**E2 / PixelHue** (`e2_…`, `pixelhue_…`): recall preset by tile to Preview or Program, TAKE, CUT, toggle and select
destinations, auto take, refresh; E2 also cue play / pause / stop and freeze. Feedbacks: preset on Preview / Program,
destination selected, auto take, connected.

**ATEM** (`atem_…`): Program / Preview source, CUT, AUTO, fade to black (+ rate), transition style, mix rate,
upstream keys on air / tie (per M/E), downstream keys on air / tie / auto, aux sources, route a source to any output
(`aux:<n>`, `me:<n>:program|preview`, `mv:<n>:<w>`, 0-based), audio input mute and fader / master fader steps,
SuperSource box source / on-off and layout recall, macro run / stop. Feedbacks: source on Program / Preview, output
source is, key states, aux source, audio muted, SuperSource box, macro running, FTB, transition running, style.

**Panasonic PTZ** (`ptz_…`): select camera; pan / tilt (8 directions or a signed proportional speed), zoom and focus
**while held**: put the move on the button's press and **PTZ: stop** on its release. While held the module re-arms
Control Center's dead-man every 0.5 s; if the release is lost, the connection drops or Companion stops, the camera
stops (max hold, or the 1.5 s dead-man). ALL STOP, session speeds, preset recall (with speed) / store (with name),
power, red / green tally, and the camera's full command set from Control Center's catalog: one-shot commands (AWB,
ABB, one-touch AF, home, OSD menu keys), on / off settings, list settings (set or step) and levels (set, up, down,
centre). Knob actions (*zoom / focus by a knob turn*, *camera level / list setting by a knob turn*, *session speed by a
knob turn*) take the turn as `$(this:delta)` and otherwise a fallback (+1 right, -1 left). Use "Selected camera" to
drive whichever camera is selected. Feedbacks: selected, tally, power, online, moving, last preset, error, any on / off
setting, any setting value.

The feedback **Generated pages: fill in linked buttons** (`cc_pages_refresh`) is internal: it makes this connection
publish its presets again after a page import. It never changes a button's look.

### Variables

Control Center status: `$(pvcc:app_version)`, `$(pvcc:app_api_version)`, `$(pvcc:show_name)`,
`$(pvcc:active_system)`, `$(pvcc:systems_connected)`, plus the CC button and deck variables above.

Per system: RS6 `last_preset_number` / `_name`, `program_presets`, `selection`, `auto_take`, `device_connected`,
`preset_N_name` / `_summary`, `input_N_label`, `<S1>_pgm_memory_number` / `_name` (and `pvw`), `master_pgm_number` /
`_name` (and `pvw`), `screen_mem_N_name`, `master_mem_N_name`, `bk_in_N_…`, `bk_bg_<screen>_<set>_…`, `bk_grp_G_…`;
E2 / PixelHue tile names and selection; ATEM Program / Preview names, `atem_out_<output>`, audio faders, SuperSource
boxes; PTZ `ptz_<id>_…` and `ptz_sel_…` (name, model, power, tally, pan / tilt / zoom / focus, iris, gain, presets).

### Upgrading

Import the new package, then click the pencil next to the version on the connection and pick the new version. The
connection and its buttons are kept.

**0.14.0** is Control Center only: the older per-system preset sections and their setting are gone. Every action,
feedback and variable is unchanged, so buttons you already placed keep working; drag new ones from the **CC deck** and
**CC** presets, or download pages from Control Center's COMPANION tab.

**Install** (macOS): `curl -fsSL https://github.com/stevenmarr/companion-module-rs6-presets/releases/latest/download/install-companion-module.sh | bash`,
then **Modules › Import module package** and choose the `.tgz` it prints. (The GitHub repository still has its first
name; the module is Performance Video Control Center.)
