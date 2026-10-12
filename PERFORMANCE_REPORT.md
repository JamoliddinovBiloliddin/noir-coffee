# NOIR COFFEE implementation and local verification

Verified 2026-10-12 on Windows 11, Node 24.11.1 and installed Chrome via Playwright.
Local performance measurements are not a guarantee for every public network or phone.

1. **Implemented:** deterministic 30 FPS clock, exact 80 active seconds, automatic
   document scrolling, Play/Pause/Replay/Skip, immediate input interruption, explicit
   buffering, visibility pause policy, reduced-motion presentation, direction-aware
   cache/prefetch, premium safe zones and production delivery variants. The completed-
   decode redraw fix and protection against late posters remain in place.

2. **Files changed or added:** `src/config.js`, `src/sequence-engine.js`,
   `src/main.jsx`, `src/styles.css`, `src/playback-clock.js`, `src/tour-controller.js`,
   `vite.config.js`, `vercel.json`, `.gitignore`, `.vercelignore`, `.env.example`,
   `package.json`, `package-lock.json`, `index.html`, `README.md`, this report,
   `scripts/optimize-frames.mjs`, `scripts/audit-assets.mjs`, `scripts/test-browser.mjs`,
   `tests/playback-clock.test.mjs`, `public/og-image.jpg`, and both optimized asset
   trees plus their provenance manifest. Existing source frames and ZIPs were preserved.

3. **Per-sequence timing:** all ten sequences delivered 240 distinct scheduled image
   indices. Every logical interval is exactly 8 active seconds. Browser display is
   quantized to RAF, so the first sampled boundary frame can be a few milliseconds
   after its scheduled instant. In the measured desktop tour, maximum sampled
   sequence-entry offset was 6.3 ms; mobile was 6.4 ms. No interpolation is applied
   to the duplicated images in the original approximately 24 FPS source export.

| Sequence | Active interval | Duration | Desktop/mobile scheduled indices drawn |
| --- | --- | --- | --- |
| 01 Hero | 00–08 s | 8 s | 240 / 240 |
| 02 Hero to cluster | 08–16 s | 8 s | 240 / 240 |
| 03 Cluster | 16–24 s | 8 s | 240 / 240 |
| 04 Cluster to roast | 24–32 s | 8 s | 240 / 240 |
| 05 Roasting | 32–40 s | 8 s | 240 / 240 |
| 06 Roast to grind | 40–48 s | 8 s | 240 / 240 |
| 07 Grinding | 48–56 s | 8 s | 240 / 240 |
| 08 Grind to brew | 56–64 s | 8 s | 240 / 240 |
| 09 Brewing | 64–72 s | 8 s | 240 / 240 |
| 10 Ceramic final cup | 72–80 s | 8 s | 240 / 240 |

4. **Total timing:** 80.000 active seconds in both real tours. Startup readiness and
   the approximately one-second delay are outside that clock. Measured wall duration
   from first detected playback to completion: desktop 80.0672 s, mobile 80.0042 s.
   Polling itself adds measurement granularity. Excluded rendering/scheduling stall
   time: desktop 33.6 ms, mobile 5.7 ms. There was no network buffering on localhost.
   The deterministic tests also pass at simulated 30, 60, 120 and 144 Hz timestamps.

5. **Auto-scroll:** operational. Frame selection and document progress follow one
   clock. Actual draws select chapter text. Manual scrolling does not compete with a
   smoothing library or independent interval. Final playback stops at source index
   2399, the white ceramic cup. ScrollTrigger refreshes and explicit navigation keep
   the frame/scroll relationship synchronized.

6. **Measured performance:**

| Metric | Desktop 1440×900 | Mobile viewport 390×844 |
| --- | ---: | ---: |
| Unique scheduled frames drawn | 2,400 | 2,400 |
| Missing/dropped scheduled indices | 0 | 0 |
| Image requests | 2,400 | 2,400 |
| Frame payload | 93,037,134 bytes | 42,030,692 bytes |
| HTTP transfer including local overhead | 93,757,134 bytes | 42,750,692 bytes |
| Resource duration p95 | 4.2 ms | 3.6 ms |
| Maximum resource duration | 25.1 ms | 13.7 ms |
| Cumulative async decode duration | 18.0934 s | 7.7707 s |
| Maximum decoded cache | 140.625 MiB | 46.828 MiB |
| Decoded-cache budget | 144 MiB | 48 MiB |
| JS heap snapshot near completion | 8.75 MB | 7.35 MB |
| Observed main-thread long tasks | 2: 56/52 ms | 1: 61 ms |

   The observed long tasks occurred during startup, before active playback. Decode
   duration is a sum of asynchronous jobs, not main-thread blocking time. Heap does
   not include all ImageBitmap/GPU/HTTP-cache allocations; total process/GPU memory
   was not measurable here. The mobile measurements use emulation on this Windows
   machine, not a physical phone. Pixel comparisons confirmed five different grinding
   images forward and identical images when returning in reverse.

7. **Asset optimization:** 2,400 original frames remain byte-identical by SHA-256,
   totaling 142,557,700 bytes. Added 2,400 desktop 1280×720 WebPs (93,037,134 bytes,
   34.7% reduction) and 2,400 mobile 768×432 WebPs (42,030,692 bytes, 70.5% reduction).
   Sample PSNR compared to resized originals was 40.06–44.10 dB; a visual comparison
   capture is in ignored artifacts. The final build is 135,844,732 bytes / 4,812 files.
   Every one of the **4,800 production variant URLs** returned a valid WebP response
   whose bytes matched dist/. Both complete variant collections were decoded during
   the measured tours. Originals are excluded from the default build.

8. **GitHub readiness:** source, lockfile, documentation, scripts, environment example
   and optimized variants are ready for the user's manual Git workflow. Original
   high-resolution collections, dist, dependencies, private env files, recordings
   and QA captures are ignored. The generated desktop/mobile collections are required
   production inputs and must be included in the push. No history was overwritten,
   no repository was initialized, and no commit or push was performed.

9. **Vercel readiness:** prepared for the chosen **Hobby Git-connected build** with
   Vite / `npm run build` / dist. Build-time asset checks, HTTPS-only external base
   configuration, finite frame caching, SPA fallback, favicon and ceramic-cup OG
   image are configured. Both `npm install` and build completed successfully.
   Production preview on port 4173 passed controls, pixel comparisons, loading,
   slow-network recovery and all 11 requested layout widths. An additional check
   covered 320×568 and 844×390 safe zones. Native wheel/touch/keyboard interruption
   and rapid reverse scrubbing passed. The hidden-tab policy was tested by invoking
   the visibility-change handler with a simulated hidden document and a CDP freeze;
   physical OS tab switching remains a publication/device check.

   The [Vercel limits page](https://vercel.com/docs/limits) specifies 100 MB Hobby
   source upload for **CLI deployments**, unlike the selected Git build. The [Hobby
   plan](https://vercel.com/docs/plans/hobby) documents a 32 GB build disk, 100 GB
   Fast Data Transfer, 10 GB Fast Origin Transfer and 1 million CDN requests. The
   bundled Git build is practical for a small personal concept site; 2,400 requests
   per cold full tour makes CDN request usage a material traffic constraint. For
   larger traffic, README.md documents real HTTPS object-storage delivery through
   `VITE_FRAMES_BASE_URL`. No CDN origin or credentials were invented or uploaded.

10. **Remaining publication checks:** no local implementation blocker was detected.
    The user still needs to push the required variants, connect GitHub to Vercel,
    confirm the resulting public asset URLs/cache/SPA headers, and measure physical
    mobile devices and real network conditions. A real Vercel deployment was not
    performed or claimed verified. Hobby supports personal/non-commercial use;
    a commercial launch needs an eligible plan. No push or deployment occurred.

Machine-readable measurements and screenshots are under ignored `artifacts/`:
`full-tour-report.json`, `browser-report.json`, `asset-audit.json`,
`production-assets-report.json`, `optimization-comparison.png`, and production
layout captures. The full report includes raw sampled sequence-entry timestamps.
Public-site transfer/cache behavior cannot be inferred from localhost latency.
