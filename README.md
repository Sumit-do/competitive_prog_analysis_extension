# 🧠 CP Metacognition

A Chrome extension that tracks your **metacognitive thinking** while solving competitive programming problems on [Codeforces](https://codeforces.com) and [AtCoder](https://atcoder.jp).

The goal isn't just to track *whether* you solved a problem — it's to understand *how* you think through them.

---

## What it does

A floating panel appears on every problem page and lets you log thoughts in real time, tagged by type:

| Tag | When to use |
|-----|-------------|
| **Observation** | Something you noticed about the input, output, or constraints |
| **Approach** | A strategy or algorithm you're considering |
| **Stuck** | You're blocked — logs a nudge reminder after 10 minutes |
| **💡 Insight** | The moment something clicked |
| **Oops** | A mistake or wrong turn you caught |

After solving (or giving up), a **Review** tab lets you record:
- Which algorithm was used
- Why you struggled (if you did)
- The single key insight that unlocked the problem
- What you'd tell past-you
- How hard it felt

All data is stored locally in Chrome — nothing is sent anywhere.

---

## The popup dashboard

Click the extension icon to see a summary across all problems:

- **Solve rate** and average time per problem
- **Failure pattern breakdown** — where you tend to get stuck (knowledge gaps vs pattern blindness vs implementation bugs, etc.)
- **Algorithm coverage** — which categories you've practiced
- **Recent problems** with status and tags
- **Total thoughts logged** — a measure of deliberate practice

---

## Install (unpacked)

1. Clone or download this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder
5. Open any problem on Codeforces or AtCoder

---

## Export your data

Click **↓ Export** in the popup to download all your metacognition logs as a JSON file — useful for backup or offline analysis.

---

## Tech

- Vanilla JS, no frameworks
- Chrome Extension Manifest V3
- `chrome.storage.local` for persistence
- Fonts: [Inter](https://rsms.me/inter/) + [Fira Code](https://github.com/tonsky/FiraCode)

---

## Why I built this

Most people doing CP track their *results* (AC / WA / TLE). Very few track their *reasoning process*. After noticing I kept making the same type of mistake (usually pattern blindness — knowing the algorithm but not seeing where it applied), I wanted a lightweight tool to make that visible.

Logging thoughts mid-solve also slows down the impulse to jump straight to code, which generally leads to better solutions.
