# Copilot — AI Mixing Companion

A dark, minimal desktop app that sits alongside Ableton Live and gives you a session engineer in your corner.

## Setup

**1. Install dependencies**
```bash
cd ~/projects/copilot
npm install
```

**2. Add your API key**
```bash
cp .env.example .env
```
Open `.env` and replace the placeholder with your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

**3. Grant permissions (macOS)**

Before first run, go to **System Preferences → Privacy & Security** and enable:
- **Screen Recording** → add Terminal (or your terminal app)
- **Microphone** → should prompt automatically on first voice input

**4. Run**
```bash
npm start
```

Webpack builds the React app, then Electron launches. Both run together via `concurrently`.

---

## Features

| Feature | How to use |
|---|---|
| **Chat** | Type in the input bar, press Enter or ↑ |
| **Voice input** | Hold the ⏺ button, speak, release to send |
| **Screen capture** | Click ⊞ to capture, then send your message — AI sees your Ableton session |
| **Voice responses** | Click 🔇 to toggle TTS on/off |
| **Save notes** | Click **Save** on any AI response |
| **Notes panel** | Click **NOTES** in the header to open/close |

Notes are saved to `~/Library/Application Support/copilot/notes.json` and persist between sessions.

---

## Troubleshooting

**Screen capture returns nothing**  
Grant Screen Recording permission to your terminal app in System Preferences → Privacy & Security → Screen Recording.

**Voice input not working**  
Microphone permission should prompt automatically. If not, add it manually in System Preferences → Privacy & Security → Microphone.

**API errors**  
Check that your `.env` file is in the `copilot/` root directory and the key starts with `sk-ant-`.

---

## Package as a standalone app
```bash
npm run package
```
Outputs a `.dmg` in `release/`. Requires the `.env` file to be present at build time.
