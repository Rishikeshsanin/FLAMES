---
version: "1.1"
name: "FLAMES Love Story"
description: "A romantic, cinematic letter-elimination game with a consent-first research layer."
colors:
  primary: "#d63a76"
  text: "#67273f"
  background: "#fff7f7"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
  sans:
    fontFamily: "DM Sans, sans-serif"
rounded:
  panel: "2rem"
  control: "999px"
spacing:
  page-max: "81.25rem"
  section-gap: "5rem"
components:
  button: {}
  card: {}
  input: {}
---

# FLAMES Design Context

## Product intent
FLAMES is a nostalgic, cinematic love-story game. Its signature moment is the one-pair-at-a-time letter ritual: highlight, connect with a glowing thread, hand-strike, sparkle, pause, then continue. The result is explicitly entertainment.

## Canonical visual system
The existing production interface is canonical. Preserve the cream-and-rose palette, Playfair Display editorial headings, DM Sans controls, Great Vibes handwritten annotations, rounded paper-like cards, subtle grain, and restrained heart/sparkle motifs. Extend existing CSS custom properties before introducing new values.

## Interaction contract
- The name form is always usable without an account or data sharing.
- Consent appears before submission. Analytics and name storage are separate, optional choices.
- Matching pairs animate sequentially. Skip, replay, speed selection, sound opt-in, and reduced-motion behavior remain available.
- Replay never creates a new attempt. A genuinely different name pair does.
- Result feedback updates the current attempt; alternatives link to it as children.
- Errors are inline or in the existing toast, never native alert dialogs.
- Public pages never expose history or administrative data.

## Responsive and accessible behavior
Support 320, 390, 430, tablet, laptop, and desktop widths without horizontal overflow. Keep keyboard focus visible, labels explicit, live status text polite, and motion cancellable. Under `prefers-reduced-motion`, decorative particles stop and sequencing collapses to brief state changes.

## Privacy boundary
Names are locally calculated first and transmitted only after affirmative analytics consent. Storage of names requires the additional name-storage consent. Names expire after 30 days; remaining research records after 90 days. No fingerprints, URL parameters, public history, or analytics SDK name logging.
