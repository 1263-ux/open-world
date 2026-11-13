# Same-source sky / shallow-water comparison

This is an isolated visual experiment, not the published game or an accepted result.

- Runtime entry: serve project root and open `/new-realigned-slice/playable/environment-ab/`.
- Buttons restore original water geometry/material for A, or use the candidate geometry/material for B. Real boat, shore and collision geometry stay unchanged.
- Offline: `blender --background --threads 2 --python render-environment.py` from this directory, or pass the full script path. Outputs A-neutral.png and C-tinted-water.png from the same camera and source GLBs, 1000×700, 64 samples, no denoising.
- Shared environment is the existing **LDR preview**, not the full HDR dynamic range. Poly Haven Industrial Sunset (Pure Sky), CC0; see `asset-recovery/hdri-study/source.json` and REVIEW.md. Source: https://polyhaven.com/a/industrial_sunset_puresky . No concept-board image is used as a backdrop or a fake game render.
- B uses roughness .16, metalness 0, a restrained #719CAD diffuse tint and two deterministic waves bounded by 1.8 cm. Runtime and Blender use the same formulas and source image. The boat/contact geometry is not altered.

## Evidence boundary
The Blender comparison uses area lighting and AgX, whereas the browser experiment uses the existing hemisphere/directional light approximation and ACES. Same source does **not** mean pixel equivalence. These images inspect geometry/material/environment direction; they are not browser screenshots, performance measurements, playtests or proof of reference-quality acceptance. Actual runtime HTML is syntax checked; GPU display remains unverified. Stable game and public Site are unchanged.

## Actual review of this iteration
A, B and C were inspected as real rendered pixels. B adds a sky but does not make the pale water convincingly different from ground. Inspection also found downward surface winding (1,376 downward normals); the isolated candidate now corrects that without mutating the baseline and has a regression test. Correct normals alone did not solve the visual issue. C reduces diffuse brightness and slightly improves separation of water from paper; it still lacks the reference's layered cloud-water atmosphere and clear fish focal point. None is accepted as final artwork. B-before-normal-fix.png and B-shared-sky-water.png retain earlier failed comparisons. Runtime B button selects the latest C material; this remains an isolated test page, not the main game.
