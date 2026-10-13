# ATEM Encoder Dials

A Companion connection for turning a Stream Deck encoder (or a button) into a dial for an ATEM upstream keyer.

It adjusts the same numbers as the Blackmagic ATEM module:

- DVE position, size, rotation, mask and border
- Luma clip and gain
- Chroma hue, gain, Y suppress and lift
- Advanced chroma foreground, background, key edge, spill, flare, brightness, contrast, saturation and RGB
- Pattern size, symmetry, softness and position

It can run next to the normal ATEM module. Both can be connected to the same switcher.

## Buttons

In Connections, add **ATEM Encoder Dials** and set the switcher IP (port 9910).

Open Presets. Each value has a **Fine** button and a **Coarse** button. Drag one onto an encoder key.

- Rotate left and rotate right change the value. A fast spin counts every detent.
- Fine is a small step (DVE position 1, size 0.01, key percentages 0.1).
- Coarse is larger (DVE position 10, size 1, key percentages 1).
- Edit the action and set Step size to **Custom** for your own amount.
- The button shows the live number for ME 1, key 1. Change Mix effect and Upstream keyer on the action for another keyer, and point the button text at the matching variable (`me2_usk1_dve_position_x` and so on).
- The button turns orange while that keyer is on air.

**Set value** types an exact number instead of stepping. Learn copies the current number into the field.

Numbers use the same units as the ATEM Companion module. Position is -1000 to 1000, size is 0 to 99.99, and the key controls are 0 to 100.

## Develop

```bash
npm install
npm test
npm run build
```

Companion loads `companion/manifest.json` and `dist/main.js`. A packaged build copies that into `builtin-modules` and installs `atem-connection` there.
