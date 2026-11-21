# Track A First Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Rakesh requested autonomous completion with a tested push per part; no further approval pauses.

**Goal:** Complete and push the team's A1, A2, and A3 with executable GPU checks.
**Architecture:** Keep the existing multi-pass renderer and GUI. Fill the G-buffer and edge shader TODOs; a small test-only harness compiles the actual GLSL and checks float render-target pixels.
**Tech Stack:** GLSL ES 3.00, WebGL2, existing three.js 0.170.0 app, Node.js and externally installed Playwright for tests only.
**Spec:** `docs/superpowers/specs/2026-11-20-track-a-first-batch-design.md`

## Global Constraints

- Derive code from the starter and mathematics; no copied online implementations or prebuilt stylization effects.
- Preserve G-buffer channels and current-minus-previous UV motion. Preserve the existing line controls.
- Use `track-a-lines`; commit/push each tested part. Do not merge main or modify B/C/D.
- Keep the app's no-build setup. Playwright is test tooling, not an app dependency.
- Verification commands below require `PLAYWRIGHT_MODULE` pointing to an existing Playwright ESM module if the package is not locally installed.

## Review Focus

- Different current/previous clip-space w must be divided independently; reject invalid previous projections.
- Previous model and camera matrices must compose in the right order.
- Empty background, silhouettes, texture borders, and subpixel line widths must remain well-defined.
- Relative depth decisions must survive depth scaling and respond to threshold/width changes.
- Non-unit normals and touching objects must not create missing or spurious creases.

## Task 1: A1 motion vectors

**Files:** modify `app/shaders/pipeline/gbuffer.vert`, `gbuffer.frag`; create `tests/run-webgl.mjs`, `tests/webgl.html`, `tests/webgl-helpers.js`, `tests/a1-motion.js`, `tests/README.md`.
**Interfaces:** existing previous matrices -> `gMotion.xy` in UV units, preserving `.zw` mesh UVs and targets 0–2. A2/A3 will reuse only test utilities, not motion code.

- [x] Add actual-shader GPU tests for static motion `(0,0)`, model/camera translation `(0.125,-0.25)`, matrix order, independent perspective division, invalid prior w, and unchanged channels.
- [x] Run `node tests/run-webgl.mjs a1`; expect motion tests to fail against the zero-motion placeholder.
- [x] Fill the previous-clip vertex expression and guarded per-fragment motion formula.
- [x] Run `node tests/run-webgl.mjs`; expect every installed test to pass. Commit A1 and push with upstream tracking; read back remote SHA.

## Task 2: A2 depth edges

**Files:** modify `app/shaders/lines/edges.frag`; add `tests/a2-depth.js`; extend suite registration.
**Interfaces:** depth in `tNormal.w`, `uTexel`, width, existing depth threshold -> line coverage in `[0,1]`; do not alter `normalEdge()` yet.

- [x] Add tests: flat/background -> 0; silhouettes/depth step -> ink; a 10x depth scaling preserves masks; increased threshold suppresses a small jump; wider width expands the edge footprint; a 0.5px width still gives nonzero coverage; uniform-depth image borders remain empty.
- [x] Run `node tests/run-webgl.mjs a2`; expect boundary tests to fail against the placeholder.
- [x] Implement Roberts-cross relative-depth detection with explicit foreground/background handling. For widths below one pixel retain a one-pixel sampling footprint and scale coverage by width to avoid vanishing with nearest-filtered textures.
- [x] Run the full suite, commit A2, push, and read back remote SHA.

## Task 3: A3 normal edges

**Files:** modify `app/shaders/lines/edges.frag`; add `tests/a3-normal.js`; extend suite registration.
**Interfaces:** view normals from `tNormal.xyz`, foreground object IDs from `tAlbedo.a`, existing normal threshold -> line coverage; preserve A2 and hull composition.

- [x] Add tests: equal normals -> 0; 90-degree change -> ink; parallel non-unit normals -> 0; foreground object-ID change -> ink; background/silhouettes valid; thresholds and widths work; disabled mode -> 0; combined modes take maximum and hull mask remains respected.
- [x] Run `node tests/run-webgl.mjs a3`; expect crease/object-boundary tests to fail.
- [x] Implement normalized normal comparisons and object-boundary detection with background guards.
- [x] Run the full suite and real app smoke checks on Bunny and Still life, including camera motion/turntable, width/threshold controls, and shader errors. Commit A3, push, and read back remote SHA.

## Final review and handoff

Review the whole diff against `fe6f171`, using a fresh reviewer, then fix significant findings with regression tests. Verify full-suite output, clean git status, remote head equality, and untouched B/C/D/shared JavaScript. Record exactly which app checks were executed. A4–A6 and the milestone report/video/slides remain outside this batch.

Completed November 21: a fresh review reproduced odd-size thin-line sampling ambiguity and motion overflow in the production half-float G-buffer. Both were reproduced locally with failing tests and fixed. Final verification: 37/37 shader checks and 15/15 real-app checks. One minor test-strengthening suggestion remains: the real-app threshold sweep allows equal counts at both extremes; synthetic tests independently require threshold sensitivity on known fixtures.
