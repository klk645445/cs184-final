# Track A first batch: motion vectors and image-space lines

Status: proposed for Rakesh's review; implementation has not started.

## Intent and scope

Get A1–A3 working for Inkwell's November 22 milestone: motion vectors, depth silhouettes, and normal/crease lines. Follow the team's `STARTER.md` and its existing WebGL2 / three.js 0.170.0 architecture. Work locally on `track-a-lines`.

The pipeline already stores previous camera and mesh matrices, exposes debug views, and composites the line mask over every style. This batch fills the three shader placeholders; it does not require changing shared JavaScript or other tracks.

## Approaches

- **Recommended: existing motion-vector contract plus Roberts-cross edge sampling.** Four corner samples at offsets of half the requested line width give a compact implementation with straightforward synthetic tests. Use relative depth changes and normal dot products with the existing thresholds.
- **Alternative: Sobel edge sampling.** A larger neighborhood can produce a smoother gradient, but requires more texture reads and kernel-specific threshold tuning. It is unnecessary for a first milestone version; revisit if measured visual quality calls for it.

Roberts cross is the assistant's recommendation, pending approval. Both choices are explicitly permitted by the starter guide.

## Behavior and files

1. **A1 — `app/shaders/pipeline/gbuffer.vert` and `gbuffer.frag`:** transform the vertex by its previous model matrix and the previous view-projection matrix. Independently perspective-divide current and previous clip positions, then store `0.5 * (currentNDC.xy - previousNDC.xy)` in `gMotion.xy`. Preserve mesh UVs in `.zw`, all other G-buffer channels, and the current-minus-previous sign convention. Avoid non-finite motion for invalid previous projections.
2. **A2 — `app/shaders/lines/edges.frag`, `depthEdge()`:** sample neighboring depths at `uLineWidth / 2` pixel offsets. Detect foreground/background boundaries explicitly, keep all-background regions empty, and normalize foreground depth changes by center depth before applying `uDepthThreshold`. Return line coverage in `[0, 1]`.
3. **A3 — the same file, `normalEdge()`:** compare normalized neighboring normals using `1 - dot(n1, n2)` and `uNormalThreshold`. Handle background before normalization. Include boundaries between distinct foreground object IDs so touching objects separate. Reuse existing line-mode switches and controls.

## Acceptance checks

Use executable WebGL checks against the actual shader files, with synthetic geometry/textures and pixel readback, rather than a separate JavaScript copy of the formulas. Verify the placeholder fails the relevant checks before implementation.

- Stationary geometry produces zero motion within render-target precision; known translations have the expected sign and UV magnitude. Exercise differing clip-space `w`, camera movement, and model movement.
- Constant foreground depth and all-background inputs produce no depth edges. Foreground silhouettes and depth steps do produce edges. Uniformly scaling foreground depths preserves relative-depth decisions; changing width changes the sampled footprint.
- Equal normals on one object produce no crease; a sharp normal change or foreground object-ID boundary produces a line. Background samples never cause invalid normalization.
- Compile/link the modified shaders, check for WebGL errors, and verify original G-buffer channels and disabled line modes remain intact.
- Record practical checks on Bunny and Still life: motion at rest/orbit/turntable, depth silhouettes, normal creases, adjustable width and thresholds. Separate automated pixel verification from any visual check still outstanding.

## Next work and boundaries

A5 reprojection follows early because Ler Koon's C4 metric depends on A1 and A5. A4 inverted-hull outlines and A6 line stability remain separate follow-up tasks. The existing measurement harness cannot prove temporal coherence/stability while A5/A6/C4 remain placeholders.

This batch does not include publishing, pushing, merging, editing another track, writing student report prose, or submitting to Gradescope. If shared JavaScript needs changing, explain the reason first; the team guide asks for group coordination before those changes.

## Milestone sources, checked November 20

- Official requirements: https://cs184.eecs.berkeley.edu/fa26/project/ — November 22 at 11:59 p.m. Pacific; roughly one printed page of progress for a CS184 group, one-minute video with every member present/speaking, and 2–3 slides. Submit the milestone PDF with clickable links to the report, slides, and video. A group containing a CS284A student follows the paper-template requirements instead.
- Staff announcement and replies: https://edstem.org/us/courses/102842/discussion/8437087 — same deadline, no late days; narration over slides is allowed. Confirm the group's CS184/CS284A composition before preparing the final report format.
- Team implementation scope: `STARTER.md`, sections 6–8. The team's November 19 target for A1–A3 is an internal schedule, not the official milestone deadline.
