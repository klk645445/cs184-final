# Track A checks

These tests compile the actual production GLSL in WebGL2 and assert float pixel readback against hand-derived fixtures. They do not substitute JavaScript versions of the algorithms.

Fixtures include the production half-float attachment format for extreme motion, and odd-sized targets with multiple edge positions for thin-line sampling regressions.

Run with Node.js, an installed Playwright package, and Chrome:

```sh
node tests/run-webgl.mjs       # every implemented suite
node tests/run-webgl.mjs a1    # motion vectors only
node tests/run-webgl.mjs a4    # inverted-hull vertex extrusion only
APP_SMOKE=1 node tests/run-webgl.mjs # also exercise Bunny/Still life in the real app
APP_SMOKE=a5 node tests/run-webgl.mjs # focus real-app checks on A5
APP_SMOKE=a6 node tests/run-webgl.mjs # focus real-app checks on A6
node --test tests/a5-warp.test.mjs  # A5 production JavaScript, no browser needed (Node 22+)
node --test tests/a5-warp.test.mjs tests/a6-line-stability.test.mjs # all CPU metric tests
```

If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to the absolute path of its `index.mjs`. `BROWSER_CHANNEL` optionally selects another installed Playwright browser channel. The default is headless Chrome, with a fresh temporary test profile and SwiftShader; your normal browser session is not used. The runner serves this checkout on a temporary loopback port and closes both browser and server afterwards. There is no app build step or new runtime dependency.

The fixtures deliberately cover direction, perspective division, matrix order, unchanged G-buffer data, invalid history, depth/normal discontinuities, and line-mode composition. A4 transform feedback captures the production hull shader's clip position to check pixel width, distance, zoom, aspect ratio, inverse-transpose normals, off-axis perspective and degenerate inputs. All expectations are based on the starter contracts and independently chosen test inputs; no external stylization implementation is used.

The optional app check needs internet for the app's existing three.js CDN imports. Set `TEST_ARTIFACT_DIR` to save canvas screenshots and JSON check summaries. It exercises static/camera/turntable motion, all three image-space line modes, and width/threshold parameters, and rejects shader/runtime errors. A separate A4 app check exercises both hull modes on Bunny/Still life, distance and zoom changes, and rasterized sphere silhouette bands at 2px and 6px (up to one pixel of raster rounding is permitted). Screenshots restore the default width/thresholds and hide DOM overlays. A5/A6 coverage is described below; other tracks' unfinished styles remain outside these checks.

The Bunny's unexpanded starter hull has one visible pixel at the default test camera, reproduced with the original `53247c8` shader. Scene checks therefore assert growth from the zero-width baseline; exact silhouette width/interior occlusion is checked on the closed sphere. This existing mesh/depth-pass artifact is not an A4 extrusion regression.

A5 unit checks cover pixel centers, current-minus-previous motion in bottom-up UVs,
RGBA/line interpolation, border rejection, mixed-depth/background footprints,
nonfinite values, resized history and immutable captures. The depth gate checks every
contributing tap against current depth (fixed 3% tolerance); it cannot guarantee
visibility with the existing depth/motion-only capture. A fixed 0.001px per-axis
motion noise floor prevents stationary GPU roundoff from crossing depth boundaries;
the suite also checks that 0.01px motion is preserved.

`APP_SMOKE=1` additionally checks A5 with actual captures: exact static identity,
camera/turntable reprojection on Bunny/Still life, rejected newly exposed floor
pixels, and the real Measure Run path producing both CSV files without an A5 skip
warning. These establish A5 integration, not acceptance of the separate C4 metric.
Background pixels, including exterior hull strokes, are invalid by the starter contract.

A6 counts strict `>0.5` line membership changes divided by the union over A5-valid
pixels; empty eligible unions return NaN. Fourteen unit checks cover known ratios,
appearance/disappearance, validity, threshold, empty sets, warped history and immutability,
including composition with A5. The A6 real-app stage captures Bunny/Still life at
`t=0,0.01,0.02` for Static, Orbit and Turntable in all six line modes. It compares
the metric to an independent set-membership oracle, records union/valid counts,
checks Static zero where eligible and NaN where empty, and verifies real Measure
CSV values (first frame blank, later Static frames/summary zero). This is a short
correctness check, not the final full-path report experiment or temporal stabilization.
The metric inherits A5's depth-gate and background-exclusion limitations; no conclusion
that pure hull outlines are stable can be drawn from an empty eligible union.
