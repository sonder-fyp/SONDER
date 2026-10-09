# Sonder proposal-defence PoC

This is the finalized clickable PoC used for the Sonder proposal defence. It combines the four-role assessment UI with the animated landing page. Diagnostic steps, AI-like replies, classes, messaging, and reports are driven by fixtures; this is not the production FYP engine or backend.

## Run

Requires Node.js and npm. In this folder:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The role selector opens student, teacher, parent, and admin flows.

Checks:

```bash
npm test
npm run lint
npm run build
```

## What to keep

The runnable source is in `app/`, `components/`, `fixtures/`, `lib/`, and `public/`. The package manifests and root configuration files are required to install, test, and build it. `SONDER.png` is the original logo artwork; the app displays the processed mark in `public/brand/sonder-mark.png`. The soundtrack used by the app is `public/audio/background.mp3`.

## Asset provenance

The landing design was adapted from `brain-extract-anatomy`, which drew from `github.com/thebuggeddev/anatomy`. The upstream project did not provide a license file. The `brain.glb` model appears to contain Tripo AI material. Check rights for those assets before public or commercial reuse. The app uses GSAP, three.js, and Lenis; their applicable licenses should be checked for any later deployment.
