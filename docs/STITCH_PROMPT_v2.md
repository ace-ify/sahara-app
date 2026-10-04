# Stitch prompt v2 — Sahārā (refine + expand)

**Context:** Sahārā — Hindi-first voice health app for elderly / low-literacy rural India on cheap Android. Keep the attached reference's warm, premium, editorial feel (cream background, rounded cards, soft depth, serif display headlines, real content). Adapt it for my users; refine, don't replace. I supply visual reference; you focus on structure, content, hierarchy, states.

**Global rules (ALL screens, incl. redoing existing):**
- Type: serif ONLY for large display/hero headlines. Body/labels/data/numbers/buttons in a high-legibility sans supporting Devanagari (Mukta / Noto Sans Devanagari). Hindi primary and larger; English secondary and smaller. Body ≥18sp; data numbers very large.
- Contrast: near-black on warm cream. No light-grey body text. AA floor, AAA on primary.
- Targets: 56dp primary; ONE primary action per screen; icon + word on actions; minimal words.
- TWO MODES:
  - CALM (everyday — Talk, Meds, Vitals, Profile, Caregiver-home, History): primary accent = teal/sage green. Red is NOT a normal-button color here.
  - EMERGENCY (SOS-active, Caregiver live-SOS, Responder): break the calm — louder, higher contrast, bigger, fewer elements; crimson/alarm red reserved exclusively here; single action (Call 108 / I'm Safe / Join) dominates.
- Imagery: minimal/none (2G); if any, warm representative elderly rural Indian imagery, sparingly.

**Generate:**
1. Onboarding + Language (Hindi/English, script sample + listen, permission explainers, big Start, voice-guided)
2. Caregiver pairing (show-QR + scan + 6-digit passkey + "Linked ✓")
3. Caregiver home (CALM) — patient card, last check-in, quick call, empty state
4. Care history / timeline (CALM) — story/timeline/summary/recall-notes pattern
5. Profile / Settings (CALM) — font-size, language, SOS trigger toggles (shake/fall/volume), contacts, Forget-me
6. Responder dispatch inbox (EMERGENCY) — incoming requests, Accept→Join
7. States — offline banner, loading, empty, error, and "no human online → SMS sent + big 108" fallback

**Also:** re-skin existing Talk/Meds/Vitals to CALM (teal, red removed from non-emergency); keep Emergency-active + Caregiver live-SOS in EMERGENCY mode.
