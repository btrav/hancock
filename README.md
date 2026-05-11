# Hancock

A signature generator that lives in your browser.

Draw or type your signature, download a transparent PNG, copy to clipboard. No signup, no upload, nothing leaves your browser.

**Live:** https://benjamintravis.com/hancock/

## Why

Every free signature generator either gates the download behind signup, watermarks the result, or produces a blurry mouse-jittered mess. Hancock is the lean version: open the page, draw, download, done.

## Features

- Draw mode with perfect-freehand stroke geometry, Pointer Events, HiDPI scaling
- Optional **Speed-aware** mode: drawing speed drives line thickness for a hand-drawn feel
- Type mode with 6 handpicked Google Fonts (Dancing Script, Sacramento, Allura, Pinyon Script, Homemade Apple, Yellowtail)
- Transparent PNG export, cropped to ink bounds
- Copy-to-clipboard
- Stroke-level undo (⌘/Ctrl+Z), with "Undo" toast for accidental Clears
- Smoothness slider applies live to existing strokes
- Auto-persist to localStorage so a refresh doesn't lose your work
- Everything runs client-side; no backend, no signup, no watermark

## Stack

- Vanilla TypeScript + Vite
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) for stroke geometry
- Pointer Events for unified mouse/touch/stylus input
- Static deploy to GitHub Pages via Actions

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Not an e-signature tool

Hancock generates signature **images**. It is not a legal e-signature tool and does not provide identity verification, audit trails, or tamper-evident records. For legally binding signatures, use DocuSign, Adobe Sign, or similar.
