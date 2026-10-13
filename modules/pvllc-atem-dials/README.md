# ATEM Encoder Dials

A Companion connection for turning a Stream Deck encoder into a dial for an ATEM keyer.

It uses the Blackmagic ATEM connection you already added. It does not ask for a second IP address.

It adjusts the same numbers as that module:

- DVE position, size, rotation, mask and border
- Luma clip and gain
- Chroma hue, gain, Y suppress and lift
- Advanced chroma foreground, background, key edge, spill, flare, brightness, contrast, saturation and RGB
- Pattern size, symmetry, softness and position
- Downstream clip, gain, rate and mask

## Buttons

In Connections, add the normal Blackmagic ATEM connection first. Then add **ATEM Encoder Dials** and choose that connection.

Open Presets. Each value has a **Fine** button and a **Coarse** button. Drag one onto an encoder key. Companion asks which mix effect and upstream keyer it controls, or which downstream keyer for a downstream preset.

- Rotate left and rotate right change the value. A fast spin counts every detent.
- Fine is a small step (DVE position 1, size 0.01, key percentages 0.1).
- Coarse is larger (DVE position 10, size 1, key percentages 1).
- The button text follows the key you picked.
- The button turns orange while that keyer is on air.

**Set value** types an exact number instead of stepping. Learn copies the current number into the field.

Numbers use the same units as the ATEM Companion module. Position is -1000 to 1000, size is 0 to 99.99, and the key controls are 0 to 100. Downstream mask is -9 to 9 vertically and -16 to 16 horizontally.

## Develop

```bash
npm install
npm test
npm run build
```

Companion loads `companion/manifest.json` and `dist/main.js`. A packaged build copies that into `builtin-modules` and installs `atem-connection` there.
