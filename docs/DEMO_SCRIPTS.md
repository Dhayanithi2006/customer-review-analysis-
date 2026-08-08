# RoadmapAI demo scripts

Direct collection = **QR + feedback form only** (Telegram is not used — same job as QR).
Do not pretend Zendesk/Intercom/App Store OAuth are live.

## Category A — QR collection (physical business)

1. Open `/register`.
2. Create a **Supermarket** (or Hospital / Hotel) with feedback method **QR Code**.
3. Open the workspace → **Sources** → Category A: print/share the **QR** (or copy the feedback URL).
4. Scan QR / open the form; submit **at least 5** reviews (mix of checkout/payment pain and soft praise). Include optional email on 1–2.
5. Workspace home → process pending submissions (needs ≥5).
6. Open **Decision Center** (`/business/{id}/analysis`).
7. Confirm top issue shows **Fix First**, pillar bars (Revenue / Reach / Severity / Tier), and copy that volume alone does not win.
8. Click **Record Action** → choose **Mark Action Taken** → save e.g. `Opened 2 additional checkout counters`.
9. Click **Send Follow-up** (only customers who left email are eligible).
10. Optional: open a follow-up link → respond Improved / Not improved.

## Category B — Existing feedback (digital / exports)

1. From the landing **Analyze** form: upload a CSV **or** run Play Store sample (`com.spotify.music`).
2. Wait for pipeline complete → session dashboard.
3. If linked to a business, open workspace **Decision Center** for the same session.
4. Show ranked issues + pillar breakdown; open Evidence / Roadmap / Sprint.

## Differentiator line (say this out loud)

> We do not rank by “most negative.” We rank by business impact: Revenue × 0.35 + Reach × 0.30 + Severity × 0.20 + Tier × 0.15 — calculated in the backend, not by the LLM.

## Ops checklist

- Run `backend/decision_pillars_migration.sql` so pillars persist on new analyses (dashboard also recomputes if missing).
- Skip Telegram setup entirely (BotFather / webhook / `TELEGRAM_BOT_TOKEN` not required).
