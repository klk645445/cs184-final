# Shader checks

These tests compile the actual production GLSL in WebGL2 and assert float pixel readback against hand-derived fixtures. They do not substitute JavaScript versions of the algorithms.

Fixtures include the production half-float attachment format for extreme motion, and odd-sized targets with multiple edge positions for thin-line sampling regressions.

Run with Node.js, an installed Playwright package, and Chrome:

```sh
node tests/run-webgl.mjs       # every implemented suite
node tests/run-webgl.mjs a1    # motion vectors only
APP_SMOKE=1 node tests/run-webgl.mjs # also exercise Bunny/Still life in the real app
```

If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to the absolute path of its `index.mjs`. `BROWSER_CHANNEL` optionally selects another installed Playwright browser channel. The default is headless Chrome, with a fresh temporary test profile and SwiftShader; your normal browser session is not used. The runner serves this checkout on a temporary loopback port and closes both browser and server afterwards. There is no app build step or new runtime dependency.

The fixtures deliberately cover direction, perspective division, matrix order, unchanged G-buffer data, invalid history, depth/normal discontinuities, and line-mode composition. All expectations are based on the starter contracts and independently chosen test inputs; no external stylization implementation is used.

The optional app check needs internet for the app's existing three.js CDN imports. Set `TEST_ARTIFACT_DIR` to save canvas screenshots and a JSON check summary. It exercises static/camera/turntable motion, all three image-space line modes, and width/threshold parameters, and rejects shader/runtime errors. Screenshots restore the default width/thresholds and hide DOM overlays. It does not test A4–A6 or other tracks' unfinished styles.
