## Performance Video Control Center

![Performance Video](icon.png)

Controls the **Performance Video Control Center** app (formerly RS6 Presets; module id `pvllc-control-center`, formerly `rs6-presets`): Analog Way Aquilon RS6 presets, Barco E2,
PixelHue, Blackmagic ATEM and Panasonic PTZ cameras. **Every command goes through the app** (default port
8080); this module never talks to a device. Remove any direct E2 / ATEM / Panasonic connections from
Companion once your buttons use this module, so there is one path to each device.

### Control Center buttons and pages (new in 0.10.0, needs Control Center app 0.31.0)

The app's **BUTTONS** and **PAGES** tabs define the buttons; Companion puts them on Stream Decks. Presets: **CC buttons**
(one per button) and **CC page: <name> (<surface>)** (keys, then the + / + XL touch strip, then the knobs). Drag them
onto a page, or lay them out with the fork's page designs and templates.

**Action** *Control Center: run a CC button* (`cc_button_run`): button, event (press / release / hold / turn /
push / touch) and a knob delta (variables allowed). The app runs the button's own actions. **Feedback**
*Control Center: look of a CC button* (`cc_button_look`): the button's text and colours from the app. **Variables:**
`$(pvcc:cc_buttons_rev)`, `$(pvcc:cc_button_count)`, `$(pvcc:cc_page_count)`.

An edit in the app, or **SYNC TO COMPANION** on the app's COMPANION tab, republishes the presets within a few
seconds. The COMPANION tab can also download a page as a `.companionconfig` for Companion's Import / Export.

### Stream Deck pages and knobs (new in 0.7.0)

The Control Center app (0.9.0+, SYSTEMS › COMPANION PAGES) makes ready-made pages for Stream Deck XL, MK.2,
+ and + XL as a `.companionconfig` file. Their buttons are **linked** to this module's presets, so they keep up
with the app (names, tally, new presets) without editing anything in Companion.

New presets per camera (category *PTZ: &lt;camera&gt; keys* and *… knobs (Stream Deck +)*), each with a stable id:

- `ptz_<cam>_move_up/down/left/right`, `_tele`, `_wide`, `_near`, `_far` (hold), `_home`, `_otaf`, `_af`,
  `_iris_auto`, `_stop`, `_readout`
- knobs `ptz_<cam>_enc_<knob>` and their touch-strip readouts `ptz_<cam>_lcd_<knob>`, for
  `zoom` (push: stop), `focus` (push: one-touch AF), `iris` (push: auto/manual), `ptspeed` and
  `zoomspeed` (session speed; push: back to 25), `gain` (push: 0 dB)

New actions for knobs: **PTZ: zoom / focus by a knob turn**, **PTZ: camera level by a knob turn**,
**PTZ: camera list setting by a knob turn** and **PTZ: session speed by a knob turn, or set it**. Each takes
the turn as `$(this:delta)` (signed detents) when Companion fills it in, and otherwise uses the *fallback*
(+1 on a right turn, -1 on a left turn in the presets), so every Companion version turns the right way.
A zoom or focus turn runs the lens for a moment and stops by itself (each detent re-arms the stop).

The feedback **Generated pages: fill in linked buttons** is internal: the generated buttons carry it so that,
right after an import, this connection publishes its presets again and the buttons fill in. It never
changes a button's look.

### E2, PixelHue, ATEM and PTZ (new in 0.6.0, needs Control Center app 0.8.0 / API 8)

The module checks `GET /api/version` for the `sysLongpoll`, `sysViews` and `companionGateway` features and
then follows the app's multi-system long-poll (`GET /api/sys?since=<rev>&views=all`). With an older app the
RS6 buttons keep working and the log says to update the app. Config: **E2 / PixelHue / ATEM / PTZ** on/off
and **PTZ max hold** (a held motion button stops by itself after this long, default 20 s).

**E2 / PixelHue** (`e2_…`, `pixelhue_…`): recall preset by tile to Preview or Program, TAKE, CUT, toggle
destination, select destinations, auto take, refresh; E2 also cue play/pause/stop and freeze. Feedbacks:
preset on Preview/Program, destination selected, auto take, connected. Variables: tile names, last preset,
selection, per-destination Program/Preview preset names.

**ATEM** (`atem_…`): Program / Preview source, CUT, AUTO, fade to black (+ rate), transition style, mix rate,
upstream keys on air / tie, downstream keys on air / tie / auto, aux sources, macro run / stop. Feedbacks:
source on Program / Preview, key states, aux source, macro running, FTB, transition running, style.
Variables: Program / Preview names, style, mix rate, FTB, aux sources, input and macro names.

**ATEM, new in 0.8.0 (needs Control Center app 0.10.0 / API 9):** *route a source to an output* (any aux / SDI
output, M/E program / preview, multiviewer window; output keys `aux:<n>`, `me:<n>:program|preview`, `mv:<n>:<w>`,
0-based), *audio input mute* (toggle / on / off), *audio input fader up / down* and *audio master fader up / down*
(dB steps), *upstream key on air / tie* now take an **M/E** (saved buttons without one stay on M/E 1),
*SuperSource box source*, *SuperSource box on / off* and *SuperSource layout recall* (the app's built-in and
saved layouts; tick "also recall the box sources" to change sources too). Feedbacks: *output source is*,
*audio input muted*, *SuperSource box on / shows a source*, and *upstream key* per M/E. Variables:
`atem_out_<output>` per output, `atem_audio_<id>_fader` / `_mix`, `atem_audio_master_fader`,
`atem_ssN_boxM`. Presets (ATEM gold): *Router* (one per output and source, up to 24 sources per output, and
a status key per output; they replace the old aux grid against app 0.10.0), *audio* (mute plus ±1 dB per input,
master ±1 dB), *keys M/E 2…* and *SuperSource* (box on / off, box ← input 1–8, one per layout). With app 0.9.x
(API 8) everything else keeps working and the log says to update the app for these.

**Panasonic PTZ** (`ptz_…`): select camera; pan/tilt (8 directions or a signed proportional speed), zoom and
focus **while held**: put the move on the button's press and **PTZ: stop** on its release (the button presets
do this). While held the module re-arms the app's dead-man every 0.5 s; if the release is lost, the
connection drops or Companion stops, the camera stops (max hold, or the app's 1.5 s dead-man). ALL STOP,
session speeds, preset recall (with speed) / store (with name), power, red / green tally, and the camera's
full command set from the app's catalog (the bitfocus Panasonic PTZ module's aw_ptz / aw_cam commands plus the
AW-UE150 interface spec): one-shot commands (AWB, ABB, one-touch AF, home, OSD menu keys, step up/down),
on/off settings (AF, auto iris, super gain, detail, colour bars, OSD menu …), list settings (gain, ND,
shutter, WB mode, scene, gamma / knee / matrix type …, set or step up/down) and levels (iris, R/B gain,
R/G/B/master pedestal, detail, gamma, knee, matrix, chroma, colour temperature: set, up, down, centre).
Use "Selected camera" to drive whichever camera is selected. Feedbacks: selected, tally, power, online,
moving, last preset, error, any on/off setting, any setting value. Variables per camera (`ptz_<id>_…` and
`ptz_sel_…` for the selected one): name, model, power, tally, pan/tilt/zoom/focus, iris, gain, shutter, ND,
WB, scene, last preset and preset names.

**Button looks (0.8.1):** each system keeps its family colour (E2 lime, PixelHue rose, ATEM gold, PTZ indigo,
RS6 blue / violet / teal …) on the same 72×72 tech-look art. Each line of a label is its own layered text element,
styled by what the key does, and each kind of line has one size on every key of that type:

- **Source** keys (tiles, memories, bus / router / SuperSource crosspoints, cameras, cues): a small mono caption top
  left in the family accent (`PGM`, `AUX 1`, `IN 3`), the name in bold sans below it.
- **Take** keys (TAKE, CUT, AUTO, FTB, STOP): the verb large in bold sans, the system or selection in mono.
- **Hold** keys (pan / tilt, zoom, focus): the arrow or the move (`TELE`, `NEAR`, in mono bold), what it moves below it.
- **Mode** keys (keys on air / tie, styles, mute, freeze, auto take, white balance): a centred mono caption over a
  hairline, then the state.
- **Step** keys (audio ±1 dB, iris / gain ±): caption, the step, and the live value in mono.
- **Readouts** (status, camera readouts, Stream Deck + strips and knobs, backups): mono throughout, left aligned,
  the header bold and underlined.

Feedbacks change the art and recolour every line. A yellow warning (input without signal, camera offline) also
strikes the name through, and black text on an amber key has no outline. Shrink to fit stays on, so it only
takes over when a name is too long. A host that cannot draw layers still gets the classic style. This needs
the Companion fork with the layered button editor (module-base 2.2).

### RS6

**Config:** the app's host/IP and port, the update mode (long-poll by default, poll only as an option) and the poll interval.

**Actions:**
- Recall preset to Preview (dropdown of the app's presets, including combined presets, e.g. `10 Panel Master + MV (M:3 S4:30 MV1:2)`)
- Load Screen memory to a destination, Load Master memory, Load Multiviewer memory (dropdowns of the memories the app imported from the RS6, with names). A Master memory load also selects the destination group stored for that master (the screens on the preset or the board), so TAKE / CUT follow it. A master with no stored screens leaves the group as it is.
- Refresh memories from the RS6
- TAKE and CUT
- Toggle destination
- Auto take (toggle, on or off)
- Input freeze
- Backup: select primary, backup 1 or backup 2 for an input, a background set (written `S1/2`) or a
  backup group. The button shows the source it protects, the backup source that slot switches to
  (an input label, `Still n` or `Native n`, not the raw `LIVE_` / `STILL_` / `NATIVE_` token) and the
  live state (`PRIMARY`, `BKP 1` or `BKP 2`, plus `AUTO`). Group buttons also list the members.
- Backup: automatic or manual mode
- Audio channel mute

**Feedbacks:**
- Preset on Preview (green) and preset on Program (red)
- Destination selected (amber)
- Auto take on
- App connected to the RS6
- **Input on Program (red)** and **Input on Preview (green)**, taken from the device, with an input
  dropdown built from the device's labels
- Destination last Screen memory is X
- Last Master memory is X
- Input frozen
- Input unavailable or disabled
- Backup active
- Audio channel muted

**Variables:** `$(pvcc:last_preset_number)`, `$(pvcc:last_preset_name)`,
`$(pvcc:program_presets)`, `$(pvcc:selection)`, `$(pvcc:auto_take)`,
`$(pvcc:device_connected)`, and `$(pvcc:preset_N_name)` for each tile (1 to the app's tile count, or the highest used; "N (empty)" for an empty tile). Swapping or moving tiles in the app (0.4.0) swaps the numbers, so buttons follow the tile. `$(pvcc:backup_group_G_name)` holds each backup group's device name. `$(pvcc:bk_in_N_name)` is the input a backup protects, `bk_in_N_src1` / `bk_in_N_src2` are the backup sources, and `bk_in_N_state` is `PRIMARY` or `BKP n` (with `AUTO` when automatic). Background sets use `bk_bg_<screen>_<set>_…`. Groups add `bk_grp_G_state` and `bk_grp_G_members`.
New in 0.5.0: the tiles follow the app's tile count (24/48/72/96), with button presets in pages of 24.
`$(pvcc:app_version)`, `$(pvcc:app_api_version)`, `$(pvcc:show_name)` and `$(pvcc:tile_count)`
are new. If the app version doesn't match, the connection shows a warning and the log says what to update.
**Upgrading:** import the new package, then click the pencil next to the version on the connection and pick
the new version. The connection and its buttons are kept.
New in 0.2.0:
- `$(pvcc:input_N_label)`
- `$(pvcc:S1_pgm_memory_number)` and `_name`, with the matching `pvw` versions
- `$(pvcc:master_pgm_number)` and `_name`, with the matching `pvw` versions
- `$(pvcc:S1_pgm_layer1)`
- `$(pvcc:live_mode)`

New in 0.3.0:
- `$(pvcc:screen_mem_N_name)` and `$(pvcc:master_mem_N_name)` for each named memory
- `$(pvcc:mv_mem_N_name)` (only with the app's memory probe on)
- `$(pvcc:preset_N_summary)`, e.g. `M:3 S4:30 MV1:2`
- `$(pvcc:memories_imported)`

**Presets:** one button per app preset, which recalls it, shows its name (from
`$(pvcc:preset_N_name)`; the number if it has no name) and shows PVW/PGM tally, plus destination
toggles, TAKE and CUT (with their target screens on a second line), and Auto take. Also: Input tally and Input freeze buttons for each input,
Backup buttons, an Audio mute button for each channel, and (0.3.0) Master memory buttons (showing the memory name), Refresh memories and a logo button. They regenerate when presets are added
or renamed in the app.

With Control Center app (then RS6 Presets) 0.2.0 or later, tally and status come from the device itself (AWJ
subscriptions), so changes made on the RC400T or the Web RCS show up. The freeze write is inferred,
because the AWJ guide documents only a read of it.

Memory import and combined presets need Control Center app (then RS6 Presets) 0.3.0 or later. Memory names are documented
(AWJ §3.7); memory validity and multiviewer memory names are inferred and only read when the app's
memory probe is enabled.

**Install** (macOS): `curl -fsSL https://github.com/stevenmarr/companion-module-rs6-presets/releases/latest/download/install-companion-module.sh | bash`,
then **Modules › Import module package** and choose the `.tgz` it prints.
