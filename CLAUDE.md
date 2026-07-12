# AYTIV — Project Context for Claude Code

Read this file at the start of every session before touching any code.

**IMPORTANT — this file supersedes all older project docs.** Any PDF, PPTX, or DOCX in
the project folder still using the names "Copilot" or "MUSE" is STALE. It also uses an
OUTDATED BUILD ORDER. Trust this file over those documents. See "Corrected Build Order"
below for why the order changed.

---

## Who You're Working With

**Developer:** Saint Frere (Brad) — artist, producer, creative director. Non-developer
building with Claude Code. Explain what you're doing in plain language before executing.
No jargon. Show a plan or mockup before building.

**Creative project names:** Saint Frere (artist), sensorydept (project/aesthetic)

---

## Project Identity

**Name:** AYTIV — FINAL. This is a coined word (phonetic play on the "-ative" in
"creative"). USPTO wordmark search returned zero live, pending, or dead marks.
Domain secured.

**One name for everything.** Aytiv is the company, the desktop app, AND the AI persona.
There is no separate persona name. The old two-name architecture (Copilot = app,
MUSE = AI) has been collapsed into one. If you see "Copilot" or "MUSE" anywhere,
it is a leftover and should be flagged.

**Tagline / positioning:** Your creative sidekick. Not music-only — a creative partner
for anyone building something that matters to them: musicians, designers, filmmakers,
writers.

**Platform note:** Aytiv is a **Mac desktop app**. There is NO mobile app. This matters
enormously for notification architecture — see below.

---

## Technical Reference

| | |
|---|---|
| **Project path** | `~/projects/aytiv` |
| **GitHub** | `brad831/aytiv` |
| **Launch** | Use the desktop shortcut (path updated to `~/projects/aytiv`) |
| **Stack** | Electron + React + JavaScript |
| **AI model** | claude-sonnet-4-5 (Anthropic API) |
| **Voice** | ElevenLabs TTS — voice ID: `EST9Ui6982FZPSi7gCHi`, model: `eleven_turbo_v2` |
| **Voice input** | Web Speech API (push-to-talk) |
| **API keys** | `~/.env` — `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` |
| **Cloud database** | Supabase — SPRINT 1 COMPLETE, all reads/writes go to Supabase |
| **Legacy local data** | `~/Library/Application Support/copilot/` — orphaned by the rename. Not in use. Do not read from it. |
| **Known quirk** | App works via desktop shortcut but not always via `npm start` due to `.env` loading. Always test via the desktop shortcut. |

### ⚠️ Supabase — Do Not Touch
The Supabase **project URL and API keys must never change.** Do NOT create a new Supabase
project under the Aytiv name. Doing so would produce an empty database and orphan the
completed Sprint 1 migration. The Supabase project *display name* is cosmetic and can be
renamed freely. The URL and keys are permanent anchors.

### Git Commands
```bash
cd ~/projects/aytiv && git add . && git commit -m "describe change" && git push
```

---

## Where The Build Actually Stands

### ✅ DONE
- **Desktop app (Layer 2)** — fully functional. Dashboard, calendar, project cards,
  notes, single project view, music card, moodboard, workspaces, session engineer,
  voice in/out, screen capture + vision analysis of Ableton sessions.
- **Sprint 1 (partial) — Supabase foundation:**
  - All 8 tables created
  - Data migrated (projects, tasks, notes, topics, workspaces)
  - Every app read/write points at Supabase
  - Migration script (`scripts/migrate.js`) — safe to re-run
- **Rename** — Copilot/MUSE → Aytiv, complete across codebase, repo, and folder path.

### ✅ ALSO DONE
- Three environments (`.env.development` / `.env.staging` / `.env.production`)
- Railway always-on server (deployed, healthy, auto-deploys from GitHub)
- SMS + onboarding state machine (Twilio → Railway → Claude → Supabase, RESET command,
  debug mode, 5 states / 3 lanes) — backend complete, awaiting A2P for SMS delivery

### ❌ NOT BUILT
- Dev log panel showing `conversation_log` (Settings screen, dev/staging only)
- Conversational project setup
- Notifications (triggers, scheduler, delivery)

---

## Corrected Build Order — READ THIS

**The original sprint plan is WRONG about ordering. Do not follow it.**

The old plan put push notifications in Sprint 1, before the server. That was based on two
assumptions that turned out to be false:

1. It assumed a **mobile app** existed to receive push notifications. It does not.
   Aytiv is Mac desktop only.
2. It assumed the notification watcher could live inside the desktop app. It cannot —
   because **notifications are a FREE-TIER feature**, and a free-tier user may never open
   the desktop app. The process that watches tasks and decides when to nudge must
   therefore run on an **always-on server**, which does not exist yet.

Notifications were not skipped. They were **deliberately moved after the server**, because
they cannot be built correctly before it. Do not flag them as a missed step.

### The order:

1. **Environments** — `.env.development` / `.env.staging` / `.env.production`.
   Small (~1 hour). Prevents SMS testing from writing into real data. Also enables a
   clean "new user" reset later for marketing documentation.
2. **Railway server** — the always-on home. Shared infrastructure for BOTH the SMS
   handler and (later) the notification watcher. Everything ambient depends on this.
3. **SMS + onboarding state machine** — Twilio → Railway → Claude → Supabase.
   5 states, 3 lanes, RESET command, debug mode. Build the **dev log panel** alongside
   this (it has nothing to display until `conversation_log` is being written).
4. **Conversational project setup** — "help me plan this album" → AI asks questions →
   generates and creates the full task list.
5. **Notifications LAST** — trigger logic (task due today/tomorrow, 48hr inactivity,
   task overdue 3+ days, Mon/Wed/Fri motivational) running on the Railway server, plus
   the phone-delivery surface. Motivational messages are push notifications, NOT SMS —
   they must be a separate channel so they don't interrupt an active text conversation.

**Open design question (decide at step 5, not before):** how push reaches a phone with no
mobile app. Two candidate paths — a thin "add to home screen" web app that exists only to
receive notifications, or a second dedicated SMS number used only for reminders.

---

## Product Architecture

| Layer | Description | Tier | Status |
|---|---|---|---|
| **Layer 1** | Ambient: SMS companion + task-linked notifications | **FREE** | NOT BUILT |
| **Layer 2** | Desktop project management app | **PAID** | BUILT |
| **Layer 3** | Cross-collaboration P2P / agent2agent | Future | FUTURE |

**"Ambient"** = the product exists in your life without being opened. Notifications come
to you; you text Aytiv from your normal Messages app. No app to launch.

**The free/paid line:** Free = SMS companion + notifications (the accountability partner).
Paid = the desktop dashboard on top. A free user creates tasks by texting and gets
reminded about them — they just don't get the visual cockpit.

---

## Cost Controls — Set Before Any Multi-User Testing

Aytiv holds the API key, so every user message spends Brad's money. Required protections:

- **Hard monthly spend cap in the Anthropic console.** Set this on day one. Caps runaway
  loops and leaked keys. Anthropic supports per-workspace limits — map these onto
  dev/staging/production so SMS testing cannot spend the production budget.
- **Per-user caps in code.** Use the `conversation_log` table to count messages per user.
  Past a daily/monthly budget, stop calling the API and reply with a graceful limit
  message. Build this INTO the SMS server as it's made — it's the first metered surface.
- **Rate limiting** — messages per minute per user. Kills loops and abuse.
- **Cheaper model for cheap work** — state detection during onboarding does not need the
  top model. Route lightweight classification to Haiku, reserve Sonnet for real
  conversation.
- **Billing alerts** so trends surface before they become problems.

Note: a free trial is a *pricing* decision, not a cost control. During a trial Aytiv still
pays. The caps above are what actually protect the bill — especially if marketing works and
signups spike.

---

## Onboarding Framework (Designed, Not Built)

Runs over SMS. The AI observes and adapts — it NEVER asks the user to pick a lane.

### Five States
| State | Description | Routes To |
|---|---|---|
| LOST | No direction, no project | Vision Lane |
| STUCK | Blocked — internal (fear/perfectionism) needs empathy first; external (time/resources) needs practical reframe first | Vision Lane |
| READY | Has project + goal, needs organizing. Largest group. | PM or Hybrid Lane |
| SKEPTICAL | Not bought in, needs an early win | Either lane |
| ADVANCED | Peer-level, clear goals | Hybrid Lane |

### Three Lanes
| Lane | For | Approach |
|---|---|---|
| Vision Lane | Lost + Stuck | Big picture → clarity → projects → tasks. 4–15 messages. Warm, exploratory. |
| PM Lane | Ready (pure execution) | Project + deadline → tasks → schedule. 4–10 messages. Efficient, direct. |
| Hybrid Lane | Ready + Advanced (creative partner) | Enters on the project, asks "why" once naturally, builds tasks + relationship. Peer-level. 6–12 messages. |

### The Opening Message (update to Aytiv)
> "Pleasure to connect. I'm Aytiv — a creative partner for people building something that
> matters to them. I have a few questions to figure out the best way I can help. First one:
> what are you working on right now — even if it's still early?"

### Guardrails
- "I don't know" twice to the same question type → pivot, don't repeat
- 3 consecutive short disengaged answers → compress and make a move
- Answer suggests more depth → one curious follow-up only
- Doubt expressed → acknowledge before moving on
- Internal block → empathy first. External block → practical reframe first.
- 4th wall breaks in 4 moments ONLY: opening framing (once), misread acknowledgment,
  someone struggling, end-of-onboarding calibration
- Max 1 proactive message/day. 3 motivational nudges/week (Mon/Wed/Fri).
- Zero mention of pricing during onboarding. Dashboard revealed passively at Day 2–3.

**The metric that matters:** did this person feel like something paid attention to them?

---

## Testing Protocol

### Five-Link SMS Chain — Build In This Order
1. Twilio → Server (echo test first, NO AI)
2. Server → Claude (log only)
3. Claude → Server → Twilio (full round trip)
4. Server → Supabase (confirm write in dashboard)
5. Supabase → Desktop app (real-time UI update)

**Rule: test each link alone before connecting the next. Never debug two broken links at once.**

### Test Environment
- Dedicated test Twilio number → dev environment only
- `RESET` command — clears session, restarts onboarding from message one
- Debug mode — appends `[DEBUG: State=X | Lane=Y]` to every response in dev/staging
- Five personas to test all five states

### Four Bug Categories
| Bug | Fix |
|---|---|
| State misdetection | Fix in the system prompt, not the code |
| Sync failure | Add polling or Supabase real-time subscription |
| SMS delivery failure | Add message sequencing + delivery confirmation |
| Context loss | Pass full conversation history with every API call |

---

## The Two Goals Driving This Build Cycle

1. **Test the complete product end-to-end as a paid user** — find and fix bugs across
   every layer.
2. **Then restart as a brand-new user** and document the onboarding journey for social
   media / marketing content.

Goal 2 is why the environments step matters more than it looks — it's what makes a clean,
repeatable new-user reset possible without destroying real data.

---

## Accounts Needed

| Service | Cost | Purpose | Status |
|---|---|---|---|
| Supabase | Free | Cloud database | ✅ SET UP |
| Railway | ~$5–7/mo | Always-on server | Needed for step 2 |
| Twilio | $2.30/mo (2 numbers) | SMS | Needed for step 3 |
| OpenAI | $0.006/min | Whisper voice transcription | Needed for step 3 |
| OneSignal | Free | Push notifications | Needed for step 5 (revisit — Electron/web push path, not mobile) |

---

## Design Status

- Current design is functional and appropriate for beta. **Do not change without instruction.**
- Design principle: mockup first, get approval, then build. Never redesign without showing it first.
- A designer engagement (Figma → Claude Code) is planned before public launch.
- `src/styles/global.css` holds font CSS variables — one-line change updates fonts app-wide.

---

## Starting a New Session

1. Read this file.
2. Ignore naming and build order in any older PDF/PPTX/DOCX — they are stale.
3. Ask Brad what he wants to work on.
4. Explain what you're about to do in plain language BEFORE doing it.
5. Never blanket find-and-replace. Flag structural identifiers and wait for approval.
6. Always test via the desktop shortcut, not `npm start`.

---

*Last updated: Steps 1–3 complete. Environments set up, Railway server deployed and healthy,
SMS + Claude onboarding state machine live. Waiting on Twilio A2P 10DLC approval (submitted
~Jul 12 2026, 2–3 week review) for full SMS round-trip confirmation. Next step: dev log
panel in Settings (shows conversation_log, dev/staging only), then step 4 — conversational
project setup.*
