# NOIR COFFEE

A React 19 + Vite + GSAP ScrollTrigger + Canvas coffee journey. Ten prepared
240-frame sequences play at a 30 FPS schedule: **8 active seconds each, 80 total**.
The final scene is the white ceramic cup. This is a brand concept presentation.

## Run locally

Node.js 22.12 or newer is required. From the project root:

```sh
npm install
npm run dev
```

Open http://localhost:5173. The dev server uses a strict port to prevent accidentally
starting a second instance. The prepared production variants are already present.

```sh
npm test
npm run build
npm run preview
```

Production preview runs at http://localhost:4173. It serves the built static site.
Use `npm ci` for a reproducible install from package-lock.json in CI.

## Playback and control

The first hero image is drawn before autoplay. A contiguous 12-frame buffer must
decode before the one-second startup delay starts. That delay is outside tour time.
One requestAnimationFrame clock selects the prepared image at `floor(t * 30)`.
The physical monitor refresh rate never controls playback speed.

Sequence windows are 00–08, 08–16, 16–24, 24–32, 32–40, 40–48, 48–56,
56–64, 64–72, and 72–80 seconds. At 80 seconds, frame 2399 remains displayed.
Source videos were approximately 24 FPS; export duplicates are displayed as supplied.
No interpolation or invented motion is applied.

Wheel, touch, pointer/scrollbar dragging, scrolling keys, and chapter clicks pause
autoplay immediately. Manual scrolling scrubs either direction. Play resumes the
current position; Replay resets the timeline; Skip displays the final cup.
Hidden tabs pause and require explicit Play when returning. Reduced-motion users
get a static chapter presentation with autoplay disabled.

ScrollTrigger measures the document range. During automatic playback, the clock
drives both native instant scroll positioning and the exact Canvas target; chapter
text follows actual Canvas draws. No Lenis, extra smoothing clock, or interval exists.

Missing critical frames create an explicit buffering state. Active time is held
until a contiguous buffer is ready. A main-thread stall cannot silently skip over
prepared frames: excess blocked time is recorded separately. Thus 80 active seconds
may take more than 80 wall-clock seconds on a slow device or network. Physical
presentation of a scheduled boundary is quantized to the browser's next RAF.

## Assets, provenance and optimization

Preserved originals remain in `public/animations/<numbered-segment>/`. They are
excluded from Git and from the default production build, and are never modified by
the optimizer. The original ZIP archives outside this project remain untouched.

The **necessary production assets must be included in your GitHub push**:

```text
public/animations/desktop/<numbered-segment>/frame_0001.webp … frame_0240.webp
public/animations/mobile/<numbered-segment>/frame_0001.webp … frame_0240.webp
public/animations/manifest.json
```

Both generated variants preserve all ten folders and all 2,400 image positions.
They are intentionally not ignored. Include them in the repository for your selected
Git-connected Vercel build. Do not push only src/ and package.json. No absolute
Windows source path is needed by the production build.

| Collection | Resolution | Total bytes | Original reduction |
| --- | --- | ---: | ---: |
| Originals | 1920×1080 | 142,557,700 | — |
| Desktop | 1280×720 | 93,037,134 | 34.7% |
| Mobile | 768×432 | 42,030,692 | 70.5% |

The default build contains both delivery variants, and selects one at initial page
load. Resizing preserves that selected decoder/cache profile for the session to avoid
duplicating network transfers. The layout still adapts to the new viewport.

`npm run assets:optimize` generates variants only when original source frames are
available. It verifies folder/name counts, records original SHA-256 hashes, and can
reuse outputs with matching source hashes and settings. `npm run assets:audit`
checks every original hash and every collection's frame count, and compares sampled
resized originals with the compressed variants. It writes ignored local QA artifacts.
Default production builds use existing variants and never re-extract ZIP archives.

The decoded-image cache has a 48 MiB mobile budget and 96–144 MiB desktop budget,
with three/four concurrent loads. Forward prefetch adapts to network/device hints;
a smaller reverse buffer and sequence-edge priority preserve continuity.
Evictions and unmounts close ImageBitmap resources. Actual decoder images, temporary
in-flight buffers, Canvas surfaces, and browser HTTP caches also consume memory;
the decoded-cache budget is not a total browser-process memory guarantee.

## GitHub and Vercel Hobby (Git-connected)

This directory had no Git history to alter. No repository was initialized, no commit
was created, and nothing was pushed. `.gitignore` excludes originals, node_modules,
dist, private environment files, QA captures and recordings. The optimized production
variants are required repository inputs.

When you connect the repository yourself, select **Vite**, **npm run build**,
and **dist**, with Node.js 22 or newer. `vercel.json` declares those values, static
asset caching and SPA fallback. Missing frame URLs return errors instead of HTML.
Frame caching is finite because frame filenames are not content hashes; hashed
JS/CSS uses one-year immutable caching. The build fails if any bundled frame is missing.

The verified build is approximately **135.84 MB / 4,812 files**. The [Vercel limits
documentation](https://vercel.com/docs/limits) states a 100 MB Hobby **CLI source-upload**
limit, which is a different deployment method from your Git-connected build. The
documented Hobby build container has 32 GB disk and a 45-minute build timeout; this
project's static build is far below those resources. These checks do not substitute
for a real deployment, which remains intentionally unperformed.

[Hobby usage](https://vercel.com/docs/plans/hobby) includes 100 GB Fast Data Transfer,
10 GB Fast Origin Transfer and 1 million CDN requests. An uncached full desktop tour
requests about 93 MB and 2,400 frames; mobile requests about 42 MB. Request volume
can become a practical limit before total bandwidth. Hobby is restricted to personal,
non-commercial use; a commercial coffee launch needs an appropriate plan.
Limits were checked on 2026-10-12; recheck before publication.

## Optional CDN delivery

Bundled variants work without external credentials. If traffic or repository size
becomes impractical, serve the exact same desktop/ and mobile/ trees from object
storage such as Cloudflare R2 behind an HTTPS delivery domain. Before changing the
build, upload and verify all 4,800 variant URLs, configure public GET access, CORS
for the site origin, `Content-Type: image/webp`, and appropriate cache headers.
No bucket, credentials, upload or fictional CDN URL was created here.

Copy `.env.example` to `.env.local` only if configuration is needed.
`VITE_FRAMES_BASE_URL` is the real public HTTPS directory containing desktop/ and
mobile/. When set, the build omits bundled frame collections; production readiness
then depends on that external origin actually containing the files. `VITE_FRAME_VARIANT`
can be `optimized` (default) or `original`. Original mode requires source assets and
should not be used for the chosen clean Git build. VITE variables are public: never
put credentials or private keys in them. Changing env values requires rebuilding.

## Browser verification

```sh
npm run test:browser
npm run test:browser -- --quick
```

Tests use installed Chrome via Playwright. Set TEST_BROWSER_CHANNEL if another
installed Chromium browser is needed. The full test runs two actual 80-second tours,
checks Canvas pixels, sequence frame counts and diagnostic timing, then tests controls,
interruption, reverse scrubbing, responsiveness and slow-network buffering.
Quick mode skips the long tours. For production preview, set TEST_BASE_URL to
http://localhost:4173 before running the quick suite. Diagnostic instrumentation is
enabled in dev; `VITE_ENABLE_DIAGNOSTICS=true` enables it in a dedicated measurement
build. Leave that unset/false for publication.

Reports/captures are written under ignored `artifacts/`. Long-task and heap results
describe the tested machine; physical-device GPU memory and public-network performance
must still be measured after publication. See PERFORMANCE_REPORT.md for local results.
