# PseudoChess: Microsoft Store listing and submission

Everything needed to submit the PWA to the Microsoft Store with PWABuilder (build plan phase 9).

## 1. Listing text

**Name:** PseudoChess

**Short description** (under 100 characters):
> Reverse chess. Lose all your pieces, or get checkmated, to win. Captures are forced.

**Description:**
> PseudoChess is chess turned upside down. Same board, same pieces, same moves, but the goal is to get rid of your army.
>
> You win when your king gets checkmated, or when you have lost every piece except your king. You lose if you checkmate the other king, or leave the other side with only its king.
>
> There is one catch: if you can capture, you must. When several captures are possible you choose which, and the pieces that must capture are outlined in gold, so you always know what the rules allow.
>
> Play against a computer opponent built for this variant, at three levels:
> - Easy looks a few moves ahead and sometimes picks a weaker move.
> - Medium looks four moves ahead and always plays its best move.
> - Hard searches as deep as it can in about two seconds.
>
> Features
> - Plays fully offline; the computer opponent runs on your device.
> - Drag and drop or tap to move, full keyboard play, and screen reader move announcements.
> - Undo, move list, and your game is saved when you close the app.
> - Five board colours, light and dark mode, optional sound.
> - No accounts, no ads, no tracking.

**What's new in this version:** First release.

**Search terms** (max 7): reverse chess, antichess, losing chess, chess variant, board game, chess puzzle, forced capture

**Category:** Games > Card & board, genre Strategy (as published)

**Published as:** PseudoChess, by Originals

**Privacy policy URL:** `https://pseudochess.maheshnanavare.co.uk/privacy.html` (the page ships with the app in `public/privacy.html`)

**Website / support:** `https://maheshnanavare.co.uk`

**Age rating (IARC questionnaire):** no violence, no user-to-user interaction, no data sharing, no purchases. Expect the lowest rating (PEGI 3 / ESRB Everyone).

## 2. Assets (all generated from code)

| Store field | File | Size | Regenerate |
|---|---|---|---|
| App icon (PWABuilder source) | `public/icons/icon-512.png` | 512 x 512 | `npm run icons` |
| 1:1 Store logo | `store-assets/store-logo-1080.png` | 1080 x 1080 | `npm run icons` |
| 16:9 Super hero art (no text; the Store overlays the title) | `store-assets/hero-1920x1080.png` | 1920 x 1080 | `npm run icons` |
| 2:3 Poster art (required for games; no text) | `store-assets/poster-1440x2160.png` | 1440 x 2160 | `npm run icons` |
| Screenshots (desktop) | `store-assets/screenshots/home-dark-1920x1080.png` (home page, use first), `desktop-light-1920x1080.png`, `desktop-dark-1920x1080.png` | 1920 x 1080 | `npm run screenshots` |
| Manifest screenshots | `public/screenshots/wide.png`, `narrow.png` | 1366 x 768, 780 x 1688 | `npm run screenshots` |

The visual language behind the icon and hero art is described in `store-assets/philosophy.md`.

## 3. Submission steps

1. **Deploy the PWA** over HTTPS. GitHub Pages builds and publishes it on every push to `master` (`.github/workflows/deploy.yml`), at `pseudochess.maheshnanavare.co.uk` (set in `public/CNAME`). One-time setup: repo Settings > Pages > Source: GitHub Actions; a DNS CNAME record `pseudochess` → `maheshnanavare.github.io`; then tick Enforce HTTPS. Confirm the site installs from Edge and works offline.
2. **Register** as an individual developer at https://storedeveloper.microsoft.com (free, ID verification).
3. **Reserve the name** "PseudoChess" in Partner Center (Apps and games > New product > MSIX or PWA app).
4. From Partner Center > Product identity, copy **Package ID**, **Publisher ID** and **Publisher display name**.
5. Go to https://www.pwabuilder.com, enter the live URL and fix anything it reports. Choose **Windows > Generate package**, paste the three identity values, keep the other defaults.
6. The download contains an `.msixbundle` for the Store (and a `.classic.appxbundle` for older Windows). Keep the zip; never commit packages or signing files (see `.gitignore`).
7. In Partner Center create the submission: upload the `.msixbundle`, fill the listing from section 1, upload the assets from section 2, complete the age rating questionnaire, set pricing (free) and markets, and submit for certification.

## 4. Pre-submission checklist

- [ ] `npm test` and `npm run build` pass; `npm run ui:smoke` passes against `npm run preview`.
- [ ] Live site: manifest has no errors in Edge DevTools > Application > Manifest.
- [ ] Offline: install from Edge, disconnect, relaunch, play a full game.
- [ ] Privacy URL opens publicly.
- [ ] PWABuilder report card has no red items.
