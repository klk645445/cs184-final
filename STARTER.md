# Inkwell starter code

This is the starter code for our final project, a real-time non-photorealistic renderer in the browser (see the proposal). Like the homework starter code, the app already runs end to end. You can load models, orbit, move the light, switch styles, view every buffer of the G-buffer, play camera paths, record video and run the measurement harness. What is left are the functions marked `TODO (Part X#)`, which are the actual styles, lines and metrics. Until a TODO is filled in, its style falls back to plain shading (or its metric returns `NaN`), so everything stays runnable at every step.

Contents

1. [Running the app](#1-running-the-app)
2. [Repository layout](#2-repository-layout)
3. [Architecture](#3-architecture)
4. [Conventions](#4-conventions)
5. [What is implemented and what is left](#5-what-is-implemented-and-what-is-left)
6. [Work split](#6-work-split)
7. [Schedule](#7-schedule)
8. [Working together](#8-working-together)
9. [Aspirational goals](#9-aspirational-goals)

---

## 1. Running the app

The app is plain JavaScript modules with no build step. three.js (0.170.0) is loaded from a CDN through the import map in `app/index.html`, so you need an internet connection, but no `npm install`.

Browsers do not allow modules or `fetch` from `file://`, so serve the repository root with any static server:

```
cd cs184-final
python3 -m http.server 8000
```

and open <http://localhost:8000/app/>.

- **Windows:** Python's server sometimes sends `.js` files with the wrong type, and the page stays blank with a "MIME type" error in the console. Use the VS Code *Live Server* extension or `npx serve` instead.
- **Online:** the same files work on GitHub Pages, at <https://klk645445.github.io/cs184-final/app/> once pushed.

### Controls

| Input | Action |
|---|---|
| Left drag / right drag / scroll | Orbit / pan / zoom |
| **R** | Reload all shaders from disk, keeping the camera and settings. Use this after every shader edit. |
| **S** | Save a screenshot (PNG) |
| **Space** | Play / stop the selected camera path |
| Drag a file onto the page | Load a model (`.ply`, `.obj`, `.stl`, `.glb`, `.gltf`, `.dae`) |

`window.app` is available in the browser console for debugging, e.g. `app.style.uniforms`.

Shader compile errors and JavaScript errors show up in red in the top-left corner, with the failing GLSL line and a few lines around it. Click an error to dismiss it. **R** clears them.

The GUI panel on the right has these folders:

| Folder | Contents |
|---|---|
| **Style** | Style dropdown. The track that owns each style is shown in brackets. |
| **Style settings** | The current style's parameters, generated from its `params`. |
| **Lines [A]** | Line mode, which works on top of any style, plus width, thresholds, ink color and opacity. |
| **View** | Debug view (see [3.6](#36-debug-views)) and pixel ratio. |
| **Scene** | Model, load file, object and background color, turntable. |
| **Light** | Direction, intensity, ambient, and "follow camera". |
| **Tonal art map [C]** | Seed and *Regenerate*. |
| **Camera path** | Path, duration, *Record video*, play. |
| **Measure** | Runs the metrics (see [3.8](#38-camera-paths-and-the-measurement-harness)). |
| **Tools** | Screenshot, reload shaders. |

---

## 2. Repository layout

```
cs184-final/
├── index.html                  project website (proposal, later milestone and final report)
├── STARTER.md                  this document
├── README.md
└── app/                        the demo
    ├── index.html              page + import map
    ├── style.css
    ├── models/                 built-in test models (binary PLY, converted from the homework meshes)
    ├── shaders/
    │   ├── common/             shared GLSL, pulled in with #include "..."
    │   │   ├── color.glsl          luma(), linearToSRGB(), srgbToLinear()
    │   │   ├── noise.glsl          hash12/22, valueNoise, fbm
    │   │   ├── surface_common.glsl varyings, uniforms and helpers for surface shaders
    │   │   └── post_common.glsl    G-buffer access and helpers for full-screen passes
    │   ├── pipeline/           the fixed passes
    │   │   ├── gbuffer.vert/.frag  G-buffer (A1 is here)
    │   │   ├── surface.vert        vertex shader for all surface shaders
    │   │   ├── depth.frag          depth pre-pass for the inverted hull
    │   │   ├── fullscreen.vert     vertex shader for all full-screen passes
    │   │   ├── blur.frag           separable Gaussian blur (reusable)
    │   │   ├── composite.frag      lines over the styled image
    │   │   ├── output.frag         final image or debug view, to sRGB
    │   │   └── capture.frag        packs data for the metrics read-back
    │   ├── lines/              Track A: edges.frag, hull.vert, hull.frag
    │   └── styles/             base.frag (done), toon, halftone, hatch_screen, hatch_tam,
    │                           posterize, kuwahara, watercolor
    └── src/
        ├── main.js             entry point
        ├── core/
        │   ├── App.js              owns everything, frame loop, events
        │   ├── Pipeline.js         render targets and the passes of a frame
        │   ├── SceneManager.js     meshes, per-pass material switching, turntable
        │   ├── Materials.js        builds the 4 materials every mesh needs
        │   ├── SharedUniforms.js   uniforms shared by every material
        │   ├── ModelLoader.js      built-in models, file loading, normalization
        │   ├── ShaderLib.js        loads .glsl files, resolves #include "..."
        │   ├── FullscreenPass.js   one full-screen triangle + ShaderMaterial
        │   ├── CameraPaths.js      deterministic camera paths
        │   ├── Recorder.js         screenshots, video, downloads
        │   ├── ErrorOverlay.js     on-page error display
        │   ├── textures.js         ramp and paper textures, seeded RNG
        │   └── UI.js               lil-gui panel
        ├── styles/             one file per style + Style.js base class + index.js registry
        ├── lines/Lines.js      Track A line modes and parameters
        ├── tam/TonalArtMap.js  Track C tonal art map generation (C2 is here)
        └── metrics/            Harness.js (done), image.js helpers (done),
                                warp.js (A5), lineStability.js (A6), strokeScale.js (B6),
                                coherence.js (C4), performance.js (D4)
```

---

## 3. Architecture

### 3.1 One frame

`Pipeline.render()` runs these passes every frame. Each box is a render target. All of them are RGBA half float, except where noted.

```
 meshes ──► [1] G-buffer pass ──► gbuffer (4 targets: tNormal, tAlbedo, tLight, tMotion) ─────────┐
   │            gbuffer.vert/.frag                                                                 │
   │                                                                                               │ (every later pass can
   ├──────► [2] Surface pass ───► surface ──► [3] Post chain ──► ping/pong ─────┐                  │  read the G-buffer)
   │            style's surface         style.post[0], [1], ...   (0 or more)    │                  │
   │            shader per mesh                                                  ▼                  │
   │                                                                     [5] Composite ──► composite ──► [6] Output ──► screen
   │                                                                          lines over style              final or debug view,
   ├──────► [4a] Inverted hull ─► hull (8-bit) ─┐                             in ink color                  linear -> sRGB
   │            depth pre-pass, then back faces │                                ▲
   │            pushed outwards (hull.vert)     ▼                                │
   └──────────────────────────────────► [4b] Edge detection ──► lineMask ────────┘
                                            edges.frag on the G-buffer, combined with the hull mask
```

A **style** decides what happens in steps 2 and 3. **Lines** (step 4) are independent of the style, so any style can be drawn with or without outlines. Steps 1, 5 and 6 are fixed.

The meshes are drawn several times per frame with different materials. `SceneManager.usePass(name)` switches every mesh to its material for that pass. Each mesh has four, built in `Materials.js`:

| Material | Vertex shader | Fragment shader | Used in |
|---|---|---|---|
| `gbuffer` | `pipeline/gbuffer.vert` | `pipeline/gbuffer.frag` | step 1 |
| `surface` | `pipeline/surface.vert` | the style's surface shader | step 2 |
| `depth` | `pipeline/surface.vert` | `pipeline/depth.frag` (color writes off) | step 4a |
| `hull` | `lines/hull.vert` | `lines/hull.frag` (back faces only) | step 4a |

### 3.2 The G-buffer

Written by `pipeline/gbuffer.frag` with multiple render targets. It is cleared to 0 every frame, so background pixels have depth 0 and object id 0.

| Texture | xyz / rgb | w / a |
|---|---|---|
| `tNormal` | view-space unit normal | linear depth (distance along the view axis, 0 = background) |
| `tAlbedo` | albedo (linear RGB) | object id / 255 |
| `tLight` | x = N·L (signed), y = N·H, z = N·V | 1 |
| `tMotion` | xy = screen-space motion in uv units (current − previous) **(Part A1)** | zw = mesh uv |

In full-screen shaders, use the helpers from `post_common.glsl` instead of sampling these directly: `getNormal(uv)`, `getDepth(uv)`, `isBackground(uv)`, `getAlbedo(uv)`, `getObjectId(uv)`, `getNdotL(uv)` and `getMotion(uv)`.

Motion vectors need last frame's matrices. The pipeline keeps them up to date: `uPrevViewProjection` is a shared uniform, and every mesh has its own `uPrevModelMatrix`, so the motion of the camera and of the object (turntable) are both covered.

### 3.3 Styles

A style is a `Style` object (`src/styles/Style.js`) with:

- **`surface`**: a surface shader (`.frag` under `shaders/`), run per mesh in step 2 like a normal material. Use this when the effect depends on the surface itself, like lighting, object-space coordinates or `gl_FragCoord` patterns on the object. It defaults to `styles/base.frag` (Lambert).
- **`post`**: a list of full-screen passes run on the surface image in step 3, in order. Each pass reads the previous one as `tInput` and the original surface image as `tSurface`, plus the whole G-buffer. A pass can have its own uniforms, like the blur direction in Watercolor.
- **`params`**: the style's parameters. Each one becomes a uniform with that name, shared by the surface shader and every post pass, and a control in the GUI. Numbers become sliders, booleans checkboxes, `color: true` color pickers (converted to linear RGB), and `options` dropdowns. Textures and other values can be added to `style.uniforms` directly.

| Style | Track | Surface shader | Post chain |
|---|---|---|---|
| Base (Lambert) | done | `styles/base.frag` | none |
| Toon | B | `styles/toon.frag` | none |
| Halftone (screen space) | B | `styles/halftone.frag` | none |
| Hatching (screen space) | C | `styles/hatch_screen.frag` | none |
| Hatching (object space, TAM) | C | `styles/hatch_tam.frag` | none |
| Posterize | D | base | `styles/posterize.frag` |
| Kuwahara (painted) | D | base | `styles/kuwahara.frag` |
| Watercolor | D | base | `blur.frag` (H), `blur.frag` (V), `styles/watercolor.frag` |

**Adding a style:** copy one of the files in `src/styles/`, point it at a new shader, and add it to the list in `src/styles/index.js`. Nothing else needs to change. The GUI, uniforms and material rebuilding are automatic.

Surface shaders start with `#include "common/surface_common.glsl"`, which declares the varyings, the `outColor` output, and:

- `Surface getSurface()`, which returns N, V, L, H, N·L, N·H, N·V and the albedo, all in view space
- `lambert(s)`, plain diffuse shading
- `diffuseTone(s)`, how lit the point is in [0, 1], used by halftone and hatching
- `vObjectPos` and `vObjectNormal`, object-space position and normal (needed for object-space hatching)

Post shaders start with `#include "common/post_common.glsl"`, which declares `vUv`, `outColor`, `tInput`, `tSurface`, the G-buffer, `uResolution` and `uTexel` (one pixel in uv units).

### 3.4 Lines

`src/lines/Lines.js` holds the line mode and parameters. The modes are *Depth edges*, *Normal edges*, *Depth + normal edges*, *Inverted hull*, and *Inverted hull + normal edges*. The pipeline:

1. **Inverted hull** (only in the hull modes): draws the meshes' front faces into the depth buffer of the `hull` target, then their back faces with `lines/hull.vert`, which pushes them outwards along the normal (**Part A4**). Only the parts that stick out past the silhouette pass the depth test.
2. **Edge detection**: `lines/edges.frag` runs over the G-buffer and writes the line mask. It takes the maximum of `depthEdge()` (**A2**), `normalEdge()` (**A3**) and the hull mask.
3. The composite pass draws the mask in the ink color over the style.

### 3.5 Tonal art map

`src/tam/TonalArtMap.js` stores 6 tones × 4 resolutions of stroke images as canvases (`images[tone][level]`, 256² down to 32²). `generate()` (**Part C2**) draws the strokes. `build()` (done) packs tones 0–2 and 3–5 into the RGB channels of two textures, with the canvases as hand-made mipmap levels, and fills in the smaller levels down to 1×1. `drawStroke()` (tileable) and `darkness()` are provided. *Regenerate* in the GUI reruns `generate()` with a new seed. The **Tonal art map** debug view shows the 6 tones side by side, lightest on the left. The top half is at full size and the bottom half is scaled down, so the mipmaps are visible.

### 3.6 Debug views

The **View → Debug view** dropdown shows any intermediate buffer instead of the final image. It is the main way to test each part.

| View | Shows |
|---|---|
| Final | the normal output |
| Surface (before post) | the surface pass, before the post chain |
| Normals | view-space normal × 0.5 + 0.5 |
| Depth | linear depth, white = near |
| Albedo | per-object albedo |
| N·L | yellow = facing the light, blue = facing away |
| Motion vectors | \|motion\| × 50 in red and green. Black when nothing moves. |
| Mesh UV | the model's texture coordinates (black if it has none, like the scanned models) |
| Object ID | a random color per mesh |
| Line mask | lines in black on white |
| Tonal art map | the 6 TAM tones |

### 3.7 Shaders, reloading and errors

- `ShaderLib.loadShader(path)` fetches a file from `app/shaders/` and replaces `#include "path"` lines with the file contents. Each file is included at most once per shader, so the common files do not need include guards. three.js's own `#include <chunk>` with angle brackets is left alone.
- All our materials are `ShaderMaterial` with `glslVersion: GLSL3` (WebGL 2), so shaders use `in`/`out`, `texture()`, and declare their output as `layout(location = 0) out vec4 outColor;` (done for you in the common files).
- three.js adds its own uniforms (`modelMatrix`, `modelViewMatrix`, `projectionMatrix`, `viewMatrix`, `normalMatrix`, `cameraPosition`) and attributes (`position`, `normal`, `uv`) to every shader, so do not redeclare them. It also already defines a GLSL `luminance()`, which is why ours is called `luma()`.
- **R** re-fetches every shader and rebuilds all materials, so you can edit GLSL and see the result immediately without losing the camera.

### 3.8 Camera paths and the measurement harness

`CameraPaths.js` defines deterministic paths over t ∈ [0, 1]. All of them look at the origin, where every model is centered.

| Path | Motion | Mainly for |
|---|---|---|
| Orbit | camera circles the model | coherence, line stability |
| Dolly in and out | camera moves straight in and back out | stroke scale |
| Turntable | camera still, model spins | coherence with object motion |
| Fly-by | sideways, closer and lower, then back | general |
| Static | nothing moves | sanity check: coherence and stability must be 0 |

The **Measure** panel (`src/metrics/Harness.js`) runs a path at a fixed resolution for the current style, both hatching styles, or all styles. For each frame it renders, reads the frame back with `Pipeline.capture()`, and calls:

| Metric | Function | File | Part |
|---|---|---|---|
| warp of the previous frame | `warpPrevious(prev, cur)` | `metrics/warp.js` | A5 |
| line stability | `lineStability(prev, cur, warped)` | `metrics/lineStability.js` | A6 |
| stroke spacing | `strokeSpacing(frame)` | `metrics/strokeScale.js` | B6 |
| temporal coherence | `coherence(prev, cur, warped)` | `metrics/coherence.js` | C4 |
| frame time | `measureFrameTimes(renderer, renderFrame, frames)` | `metrics/performance.js` | D4 |

Results are printed with `console.table` and downloaded as two CSV files: per frame (`inkwell-frames-*.csv`) and per style (`inkwell-summary-*.csv`, with averages, min/max stroke spacing, mean and 95th-percentile frame time, and fps). The frame resolution can be set to 1920×1080 for the final numbers, as in the proposal.

### 3.9 Models

Built-in models are listed in `ModelLoader.js` under `BUILTIN_MODELS`:

- **From the homeworks** (in `app/models/`): Bunny, Dragon, Max Planck, Beast, Cow and Teapot.
- **Procedural**: Sphere, Torus knot, *Still life* (several objects on a ground plane, good for object-id edges), and a 1M-triangle torus knot for the performance target.

`normalizeModel()` bakes every transform into the geometry and scales the whole model into the unit sphere, so `vObjectPos` is in about [−1, 1]³ for every model. Scanned models have no texture coordinates, which is why object-space hatching uses triplanar mapping.

---

## 4. Conventions

- **Color:** everything inside the pipeline is linear RGB. Only `output.frag` converts to sRGB. Color params in the GUI are sRGB and converted automatically.
- **uv:** in [0, 1]², with (0, 0) at the bottom-left of the image, for both textures and full-screen passes.
- **Motion:** `motion = uv_current − uv_previous`, in uv units. The same surface point was at `uv − motion` in the previous frame.
- **Tone:** `diffuseTone()` gives 0 = darkest and 1 = brightest. TAM textures store 1 = paper and 0 = ink, and tone 0 of the TAM is the lightest.
- **Object id:** 1, 2, 3, … per mesh, 0 = background.
- **Captured frames** (`Pipeline.capture()`): `Float32Array`s with pixel (x, y) at index `y * width + x`, and row 0 at the bottom. Fields are `color` (RGBA), `lineMask`, `motion` (2 per pixel), `depth` (0 = background).
- **Restrictions from the proposal:** every style is our own `ShaderMaterial`. Do not use `MeshToonMaterial`, `OutlineEffect`, `OutlinePass`, `HalftonePass`, `SobelOperatorShader` or other three.js stylization features. The three.js add-ons we do use are only infrastructure: OrbitControls, the model loaders and lil-gui.

---

## 5. What is implemented and what is left

**Implemented:** the app shell and GUI, model loading and normalization, the full multi-pass pipeline and G-buffer (except motion vectors), per-mesh materials and pass switching, the style system with automatic GUI, the Base style, the blur pass, the composite and output passes, every debug view, shader includes and hot reload, the error overlay, TAM packing and mipmaps, the ramp and paper textures, palettes, camera paths, screenshots and video recording, and the measurement harness with read-back and CSV export.

**Left:** 20 parts in four tracks, all marked `TODO (Part X#)` in the code. Search for `TODO (Part` to find them all.

---

## 6. Work split

The proposal gives each of us one family of styles, with the lines owner also owning the shared G-buffer pipeline. Each track also owns one of the proposal's metrics, so the measurement work is split evenly as well. Every track's files are separate, so we rarely edit the same file.

Parts are numbered in the order to do them. Every part has a way to see that it works before moving on.

| Track | Focus | Owner | Styles / features | Metric | Main files |
|---|---|---|---|---|---|
| **A** | Lines & pipeline | Rakesh | motion vectors, depth / normal edges, inverted hull | warp + line stability | `pipeline/gbuffer.*`, `lines/*`, `metrics/warp.js`, `metrics/lineStability.js` |
| **B** | Toon & halftone | Lena | toon (bands, ramp, rim, specular), halftone dots | stroke scale | `styles/toon.frag`, `styles/halftone.frag`, `metrics/strokeScale.js` |
| **C** | Hatching | Ler Koon | screen-space hatching, tonal art map, object-space hatching | temporal coherence | `styles/hatch_*.frag`, `tam/TonalArtMap.js`, `metrics/coherence.js` |
| **D** | Painterly | Alex | posterize, Kuwahara, watercolor | performance | `styles/posterize.frag`, `styles/kuwahara.frag`, `styles/watercolor.frag`, `metrics/performance.js` |

### Track A: Lines and pipeline

Owns the G-buffer and the pipeline (`Pipeline.js`, `gbuffer.*`). Other tracks should go through this person for changes to shared pipeline code.

| Part | File | Task | Test |
|---|---|---|---|
| **A1** Motion vectors | `pipeline/gbuffer.vert`, `gbuffer.frag` | Previous clip-space position from `uPrevModelMatrix` and `uPrevViewProjection`, then motion = difference of the two after the perspective divide, in uv units. | *Motion vectors* view: black when still, colored while orbiting, only the model colored with *Turntable* on. |
| **A2** Depth edges | `lines/edges.frag` `depthEdge()` | Depth discontinuities (Sobel or Roberts cross), relative to the center depth, offset by the line width. Background counts as far away. | Lines → *Depth edges*: outline around the silhouette. *Width* changes its thickness. |
| **A3** Normal edges | `lines/edges.frag` `normalEdge()` | Normal discontinuities (1 − n₁·n₂), optional object-id edges. | *Normal edges* on Still life: lines on the box's edges and where objects meet the floor. |
| **A4** Inverted hull | `lines/hull.vert` | Push back faces outwards along the normal, in clip space for a constant width in pixels. | *Inverted hull*: outline of constant width when zooming in and out. |
| **A5** Warp | `metrics/warp.js` `warpPrevious()` | Reproject the previous frame through the motion vectors, with border and disocclusion checks. Shared by A6 and C4. | Measure → path *Static* gives coherence 0 for any style (once C4 is done). On Orbit, screen-space hatching gives a much higher value than Base. |
| **A6** Line stability | `metrics/lineStability.js` | Fraction of line pixels that appear or disappear after warping. | *Static* gives 0. Compare the line modes on *Orbit*. |

Depends on nobody. A1 and A5 are needed by C4, so do them early.

### Track B: Toon and halftone

| Part | File | Task | Test |
|---|---|---|---|
| **B1** Bands | `styles/toon.frag` `toonDiffuse()` | Quantize N·L into `uBands` flat bands. | Toon: hard steps in the shading, *Bands* changes their number. |
| **B2** Color ramp | `toonColor()` | Look up band colors in `tRamp` when *Use color ramp* is on. | The three ramp colors appear as flat bands, and editing them updates live. |
| **B3** Rim light | `rimTerm()` | Hard-edged band from N·V along the silhouette. | Bright edge around the model on the lit side. *Rim width* changes it. |
| **B4** Specular | `toonSpecular()` | Thresholded Blinn-Phong. | Flat white highlight blob that moves with the light. |
| **B5** Halftone | `styles/halftone.frag` `halftone()` | Rotated screen grid, dot radius from tone, antialiased. | Dots that grow in the shadow. *Dot spacing* and *Grid angle* work. |
| **B6** Stroke scale | `metrics/strokeScale.js` | Average spacing between ink runs along rows and columns. | Halftone on *Dolly in and out*: spacing stays at about the dot spacing. Compare against the TAM hatching once C3 is done. |

Depends on nobody. B is the lightest track, so it also takes the first aspirational goal (object-space halftone and stippling, see [9](#9-aspirational-goals)).

### Track C: Hatching

This is the main technical contribution in the proposal, the screen-space vs. object-space comparison.

| Part | File | Task | Test |
|---|---|---|---|
| **C1** Screen-space hatching | `styles/hatch_screen.frag` | One layer of antialiased parallel lines, then more layers (cross-hatching) as the tone gets darker. | Hatching (screen space): lines get denser in the shadow. Orbiting shows them sliding over the surface (the shower-door effect, intended). |
| **C2** Tonal art map | `tam/TonalArtMap.js` `generate()` | Stroke placement with nesting in tone and in resolution (Praun et al., Section 3). | *Tonal art map* view: 6 tones from light to dark, each containing the strokes of the lighter ones. The bottom half (mipmapped) looks like the top half at a smaller scale. |
| **C3** Object-space hatching | `styles/hatch_tam.frag` | Blend the two nearest TAM tones (6-way blend with two dot products), and triplanar mapping on `vObjectPos`. | Hatching (TAM): strokes stay attached to the model with *Turntable* on, and keep a similar width on screen when zooming. |
| **C4** Coherence | `metrics/coherence.js` | Mean luminance difference over stroke pixels after warping. | Measure → *Both hatching styles* on *Orbit*: the TAM value is clearly lower than the screen-space one. *Static* gives 0. |

C3 needs C2 for real strokes. To start C3 earlier, draw a few test strokes in `generate()`. C4 needs A1 and A5.

### Track D: Painterly

| Part | File | Task | Test |
|---|---|---|---|
| **D1** Posterize | `styles/posterize.frag` | Nearest palette color, optionally weighted by brightness (`uLumaWeight`). | Posterize: only palette colors appear. Switching *Palette* works. |
| **D2** Kuwahara | `styles/kuwahara.frag` | 4 regions, pick the mean of the one with the lowest variance. | Flat painted patches with sharp edges. *Radius* changes the patch size. |
| **D3** Watercolor | `styles/watercolor.frag` | Wobble, edge darkening and granulation/turbulence as pigment densities, using `applyDensity()` (provided, from Bousseau et al.). | Soft color with darker rims at color edges and paper texture in flat areas. Each slider visibly changes its effect. |
| **D4** Performance | `metrics/performance.js` | Time frames with a GPU sync (1-pixel `readPixels`) or timer queries, with warm-up frames. | Measure on the 1M-triangle torus knot gives a lower fps than on the Bunny. *All styles* gives a frame-time table for the report. |

Depends on nobody.

### Workload

Each track has about the same amount of work. A has more small parts and owns the pipeline. C has the hardest single part (C2) and the main comparison. B is the lightest but takes the first aspirational goal. D has the most open-ended style (watercolor).

---

## 7. Schedule

This follows the proposal's weekly plan.

| Week | A | B | C | D |
|---|---|---|---|---|
| **1** (to Nov 19) | A1, A2, A3 | B1, B2, B3 | C1, C2 | D1, D2 |
| **2** (Nov 20–26, milestone **Sun Nov 22**) | A4, A5 | B4, B5 | C3 | D3 |
| **3** (Nov 27 – Dec 3, HW4 and Exam 2) | A6, run measurements | B6, aspirational | C4, hatching comparison | D4, timing table |
| **4** (Dec 4–8) | final renders, video, report, presentation (everyone) | | | |

**Milestone checklist (Nov 22):** at least the first version of every track's styles (toon bands, edge lines, screen-space hatching, posterize, Kuwahara), early object-space hatching (C2 and C3 in progress), and screenshots from the debug views. Use **S** for screenshots and *Camera path → Record video* for clips.

---

## 8. Working together

- Commit under your own GitHub account. Staff use the commit history to check contributions.
- Use one branch per track (`track-a-lines`, ...) and merge into `main` often. The tracks touch separate files, so merges are usually clean.
- Shared files (`Pipeline.js`, `App.js`, `SharedUniforms.js`, the `common/` shaders) affect everyone. Tell the group before changing them.
- New tunable values go into a style's `params`, not hard-coded constants, so they show up in the GUI and in screenshots of the settings.
- Before merging, run **Measure** with path *Static* on your style and check that the coherence and stability are 0 (once A5, A6 and C4 exist), and that there are no red errors.

---

## 9. Aspirational goals

These are not in the starter code, but the architecture has places for them.

| Goal (proposal) | Where it plugs in |
|---|---|
| Stippling, object-space halftone and stippling | New surface styles. Copy `halftone.js`/`.frag` and use `vObjectPos` (triplanar, like C3) instead of `gl_FragCoord`. Measured with the same harness. |
| Full watercolor | More passes in the Watercolor style's `post` list (e.g. pigment flow from the G-buffer normals). |
| Suggestive contours | Needs per-vertex curvature. Compute it in `ModelLoader.normalizeModel()` as an extra attribute, pass it through a varying, and add an edge term in a new line mode. |
| Style blending, per-object styles | The object id is already in the G-buffer (`getObjectId`). A post pass can choose between two style outputs per object or blend over time. |
| Short film | `CameraPaths.js` (add a path) + *Record video*. |
