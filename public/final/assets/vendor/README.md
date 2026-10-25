# Final vendor scripts

Copied from the npm registry so the page stays same-origin under the site CSP (`script-src 'self'`).
No build step and no runtime npm dependency.

| File | Package | License |
| --- | --- | --- |
| gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, DrawSVGPlugin.min.js, CustomEase.min.js | `gsap@3.15.0` (`dist/`) | GreenSock Standard "No Charge" License — https://gsap.com/standard-license (header kept in every file) |
| lenis.min.js, lenis.css | `lenis@1.3.27` (`dist/`) | MIT — see LICENSE-lenis.txt |

Only trailing `sourceMappingURL` comments are removed, because the map files are not shipped.
To upgrade: `npm pack gsap@<version> lenis@<version>`, copy the same `dist/` files here, then run `npm run final:build`.
