# Story vendor scripts

Copied unmodified from the npm registry so the page stays same-origin under the
site CSP (`script-src 'self'`). No build step, no npm dependency at runtime.

| File | Package | License |
| --- | --- | --- |
| gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, DrawSVGPlugin.min.js, MotionPathPlugin.min.js, ScrambleTextPlugin.min.js | `gsap@3.13.0` (`dist/`) | GreenSock Standard "No Charge" License — https://gsap.com/standard-license (header kept in every file) |
| lenis.min.js, lenis.css | `lenis@1.3.11` (`dist/`) | MIT — see LICENSE-lenis.txt |

The only change is removing the trailing `sourceMappingURL` comment from
lenis.min.js, because the map file is not shipped.

To upgrade: `npm pack gsap@<version> lenis@<version>`, copy the same `dist/`
files here, then run `npm run docs:sync` so the `?v=` hashes update.
