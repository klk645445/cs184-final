# C4: hatching temporal coherence

Mean temporal incoherence (`app/src/metrics/coherence.js`): the average luminance difference over stroke pixels
(linear luminance below 0.5 in either frame) between each frame and the previous frame warped onto it by A5.
Lower is more coherent. Each value is the mean over 59 frame pairs of a 60-frame camera path at 1920 x 1080,
with the default style parameters and lines off. Produced with the real Measure harness (`runMeasurement`).

| Model | Path | Base | Screen-space hatching | TAM hatching | TAM / screen |
|---|---|---|---|---|---|
| Bunny | Static | 0.000 | 0.000 | 0.000 |  |
| Bunny | Orbit | 0.024 | 0.514 | 0.084 | 0.16 |
| Bunny | Turntable | 0.024 | 0.509 | 0.081 | 0.16 |
| Bunny | Dolly in and out | 0.046 | 0.463 | 0.149 | 0.32 |
| Bunny | Fly-by | 0.009 | 0.505 | 0.073 | 0.14 |
| Dragon | Static | 0.000 | 0.000 | 0.000 |  |
| Dragon | Orbit | 0.026 | 0.507 | 0.087 | 0.17 |
| Dragon | Turntable | 0.026 | 0.502 | 0.084 | 0.17 |
| Dragon | Dolly in and out | 0.171 | 0.507 | 0.220 | 0.43 |
| Dragon | Fly-by | 0.022 | 0.502 | 0.091 | 0.18 |
| Teapot | Static | 0.000 | 0.000 | 0.000 |  |
| Teapot | Orbit | 0.023 | 0.492 | 0.078 | 0.16 |
| Teapot | Turntable | 0.023 | 0.488 | 0.076 | 0.16 |
| Teapot | Dolly in and out | 0.050 | 0.431 | 0.117 | 0.27 |
| Teapot | Fly-by | 0.009 | 0.506 | 0.067 | 0.13 |
| Still life | Static | 0.000 | 0.000 | 0.000 |  |
| Still life | Orbit | 0.010 | 0.469 | 0.088 | 0.19 |
| Still life | Turntable | 0.010 | 0.468 | 0.087 | 0.19 |
| Still life | Dolly in and out | 0.015 | 0.403 | 0.088 | 0.22 |
| Still life | Fly-by | 0.005 | 0.513 | 0.077 | 0.15 |

Averages over the four models:

| Path | Screen-space | TAM | TAM / screen |
|---|---|---|---|
| Orbit | 0.495 | 0.084 | 0.17 |
| Turntable | 0.492 | 0.082 | 0.17 |
| Dolly in and out | 0.451 | 0.144 | 0.32 |
| Fly-by | 0.506 | 0.077 | 0.15 |

Observations:

- *Static* gives 0 for every style and model, as required (the Teapot gives about 1e-8 in some runs, which is
  floating-point roundoff in the reprojection, not motion).
- Screen-space hatching stays at about 0.5 on every moving path: its lines are fixed to the screen, so after
  warping they land on paper about half the time (the shower-door effect).
- Object-space (TAM) hatching is about 6 times more coherent on Orbit, Turntable and Fly-by (ratio 0.15 to 0.19).
  The remaining incoherence is most likely from tone blending as the shading changes and from bilinear
  resampling in the warp.
- *Dolly in and out* is the hardest path for the TAM (ratio 0.22 to 0.43), because the GPU blends between mip
  levels as the distance changes, so strokes from a finer level fade in and out.
- The 1024 x 1024 TAM (finest level added for close-ups) changes the values by less than 0.03 compared with the
  previous 256 x 256 map (column `coherence_tam256` in the CSV).

Raw values: `c4-hatching-comparison.csv`. Frame times are not meaningful here, because these runs used
headless Chrome with software rendering (SwiftShader).
