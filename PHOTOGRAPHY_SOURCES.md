# WealthLight photographic backgrounds — v10

WealthLight's natural-photography visual revision replaces AI-composited mountains and artificial data-light trails on the website with **actual camera photographs**.

## Photo sources (Unsplash License)
All photographs below are on Unsplash's free-photo pages. Their photo IDs are used in `styles/photographic-v10.css`; the images are currently delivered through Unsplash's CDN rather than checked into this repository.

| Usage | Photographer | Photo / source |
|---|---|---|
| Home and 10-second intro | Jeremy Bishop | https://unsplash.com/photos/landscape-photography-of-mountains-covered-by-snow-xsxc8yTZk0U |
| About, contact and perspective | Alessio Soggetti | https://unsplash.com/photos/mountain-in-mist-Q34UnSczYXE |
| Markets | Ingo Stiller | https://unsplash.com/photos/sunrise-over-snowy-mountain-peaks-at-dawn-gjlakWv0wFA |
| Research, approach and technology | Lilian Fayot | https://unsplash.com/photos/dramatic-mountain-peaks-shrouded-in-mist-at-dawn-lc189T4hfUg |
| Risk management | Caroline Badran | https://unsplash.com/photos/dark-mountains-shrouded-in-mist-at-dawn-jv0YIBDYfr0 |
| Strategies and institutional | Jonas Degener | https://unsplash.com/photos/dramatic-mountain-peaks-shrouded-in-mist-t4tn3SLE1z4 |

License: https://unsplash.com/license

## Motion specification
- The opening sequence is 9 seconds of static original WealthLight logo and restrained photographic crossfade, followed by 1 second of exit transition.
- No animated blue/gold energy rings, artificial neon charts, light trails or composite 3D-looking mountain effects.
- The mountains are still photographs. This avoids obvious oscillating perspective, inconsistent horizon movement and unnatural zooms.
- Body content remains easy to read on cohesive navy backgrounds, not tiled repeated mountain images.
- Respect operating system reduced motion settings.

## Production consideration
The CDN provides high-quality externally hosted photographs. For long-term stability, license retention and complete self-hosting, a future release should download, optimize and commit each approved photograph to the project's `assets/` directory. Do not silently substitute synthetic images if the CDN fails.
