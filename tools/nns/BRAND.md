# Nustand

Nustand comes from the Neesh thesis that spaces are the new newsstands.
Nu borrows from nu-disco and nu-jazz: an old form remade by a new scene.

Use **Nustand** as one word in product names, prose, navigation, report titles,
accessible labels and metadata. Never use camel casing inside the name or an
umlaut. The name replaces New Newsstand and its former product abbreviation.

## Wordmark requirement

Set Nustand in the same typeface, case, weight and color as the Neesh and Index
wordmarks. Use the source brand lettering; do not substitute a body or display
font merely because the website loads it.

The current Neesh reference is uppercase, black (#000000) on white, reversed
to white on black. It is supplied as outlined SVG paths in the Index site's
Logo component and as src/assets/neesh-logo.png in this repository. Outlined
paths do not identify the original typeface or font weight.

The legacy Index header uses an Inter semibold “Index by” label beside the
Neesh image; that UI label is not sufficient evidence of a shared wordmark
typeface. Archivo headings and Manrope body text likewise do not establish
the logo's typeface.

## Custom vector construction

The owner's follow-up brief specifies uppercase heavy geometric grotesque,
Manrope ExtraBold as the closest reference, and redrawing against the Neesh
vector rather than typesetting. The new Nustand artwork reuses the exact N
and S outlines from Neesh and draws U, T, A and D to the same proportions.
The final D alone carries the signature square. Default black on white and
white-on-black SVGs were delivered as separate design artifacts.

- Cap height: 138.59 units; curve overshoot: 143.50 total units.
- Vertical stem: 27.13 units.
- Signature square: 57.60 by 57.60 units, y=2.55 through y=60.15.
- Corner-only contact and 27.13-unit horizontal shift from the removed stem,
  matching the Neesh H construction.
- Even outer padding: 57.60 units. No external font dependency in the marks.

The family comparison uses the original Neesh vector and an explicitly labeled
provisional Index reconstruction. The original Index wordmark is still needed
for an authentic three-mark comparison. Accessible text remains Nustand while
the visual wordmark reads NUSTAND.

## Internal compatibility

Keep the existing tools/nns path, Python module, sample seed, cache lineage and
draft branch name stable during this pilot. Historical run files and source
specifications retain their original names and version metadata. These are
internal identifiers, not the product's displayed name.
