# Shader checks

These tests compile the actual production GLSL in WebGL2 and assert float pixel readback against hand-derived fixtures. They do not substitute JavaScript versions of the algorithms.

Fixtures include the production half-float attachment format for extreme motion, and odd-sized targets with multiple edge positions for thin-line sampling regressions.

Run with Node.js, an installed Playwright package, and Chrome:

```sh
node tests/run-webgl.mjs       # every implemented suite
node tests/run-webgl.mjs a1    # motion vectors only
node tests/run-webgl.mjs a4    # inverted-hull vertex extrusion only
APP_SMOKE=1 node tests/run-webgl.mjs # also exercise Bunny/Still life in the real app
```

If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to the absolute path of its `index.mjs`. `BROWSER_CHANNEL` optionally selects another installed Playwright browser channel. The default is headless Chrome, with a fresh temporary test profile and SwiftShader; your normal browser session is not used. The runner serves this checkout on a temporary loopback port and closes both browser and server afterwards. There is no app build step or new runtime dependency.

The fixtures deliberately cover direction, perspective division, matrix order, unchanged G-buffer data, invalid history, depth/normal discontinuities, and line-mode composition. A4 transform feedback captures the production hull shader's clip position to check pixel width, distance, zoom, aspect ratio, inverse-transpose normals, off-axis perspective and degenerate inputs. All expectations are based on the starter contracts and independently chosen test inputs; no external stylization implementation is used.

The optional app check needs internet for the app's existing three.js CDN imports. Set `TEST_ARTIFACT_DIR` to save canvas screenshots and JSON check summaries. It exercises static/camera/turntable motion, all three image-space line modes, and width/threshold parameters, and rejects shader/runtime errors. A separate A4 app check exercises both hull modes on Bunny/Still life, distance and zoom changes, and rasterized sphere silhouette bands at 2px and 6px (up to one pixel of raster rounding is permitted). Screenshots restore the default width/thresholds and hide DOM overlays. It does not test A5–A6 or other tracks' unfinished styles.

The Bunny's unexpanded starter hull has one visible pixel at the default test camera, reproduced with the original `53247c8` shader. Scene checks therefore assert growth from the zero-width baseline; exact silhouette width/interior occlusion is checked on the closed sphere. This existing mesh/depth-pass artifact is not an A4 extrusion regression.
