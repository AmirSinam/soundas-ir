# Player backgrounds

Drop image files in this folder and they appear as choices under the player's
**Look** sheet. Nothing else has to change — no code, no pubspec edit: the
folder is declared as a whole, and the app reads the bundle's asset manifest at
launch to see what is in it.

- Accepted: `.jpg`, `.jpeg`, `.png`, `.webp`
- Only files sitting directly in this folder are offered. Resolution variants
  (`2.0x/name.jpg`, `3.0x/name.jpg`) still work — Flutter picks the right one
  for whichever picture is chosen.
- Order in the sheet is the filename's, so a `01-`, `02-` prefix controls it.

Two things worth knowing when choosing pictures:

- They are shown dimmed and with a wash toward the bottom, because the titles
  and controls drawn on top were designed against a dark ground. A picture that
  looks washed out here is behaving correctly.
- Portrait shots suit it better than landscape: the background is cropped to
  cover a phone-shaped screen.

The file is not deleted when the app updates, and nothing is downloaded — these
ship inside the build.
