# Asomi – frontend

Expo / React Native app for the Asomi Android voice assistant. Phase 2 of
`../project_planning/docs/08-roadmap-and-build-steps.md`.

**Status: scaffolded, dependencies not installed.** Every source and config file
is written, but `node_modules` is empty by design — nothing has been downloaded
to this machine yet. See [Install](#install) below.

| Roadmap step | State |
| --- | --- |
| 15 · Expo app with TypeScript + Expo Router | Done |
| 16 · expo-dev-client + development build | **Dep installed, build deferred** (no JDK) |
| 17 · NativeWind, fonts and theme tokens | Done |
| 18 · Android permissions in app.json | Done |

## Install

```bash
cd frontend
npm install
cp .env.example .env     # set EXPO_PUBLIC_API_URL to your laptop's LAN IP
npm run typecheck
npm run lint
```

Versions in `package.json` were pinned from the npm registry against
**Expo SDK 58** — taken from `expo-template-default@58.0.23`, which is what a
fresh `create-expo-app` would produce. Two things to know:

- **TypeScript is `~6.0.3` here** but `^5.6.0` in `backend/`. That's Expo SDK
  58's own pin, not a mistake. They're separate packages with separate
  `node_modules`, so the major-version gap is harmless.
- **The template's iOS/demo extras are omitted** — `@expo/ui`, `expo-symbols`,
  `expo-glass-effect`, `expo-image`, `expo-device`, `expo-web-browser` — as are
  the web deps (`react-dom`, `react-native-web`), since Asomi is Android-only
  (`app.json` sets `"platforms": ["android"]`). `expo-router` lists some of
  these as peers, so `npm install` may print peer warnings. They're harmless;
  add any back with `npx expo install <name>` if you want them.

### One pairing to verify on first install

NativeWind 4.2.7 shipped **2026-09-14**; Expo SDK 58.0.1 shipped
**2026-10-01**. NativeWind has released nothing since SDK 58 appeared, so this
combination has never been tested upstream. It's the stable choice available —
NativeWind 5 is still `5.0.0-rc.0` and would pull Tailwind 4 plus
`react-native-css@3.1.0-rc.0`, i.e. two pre-release deps under all your styling.

First install is the moment to check it:

```bash
npx expo start --clear     # Metro must compile global.css without erroring
```

If NativeWind can't cope with SDK 58, **nothing in `src/theme/` is wasted.**
Tokens are plain data and `typography` already exports ready-made
`TextStyle` objects, so the fallback is to drop `className` for `style={}` —
no re-authoring of the design system. The other options are pinning Expo 57
(`npx expo install expo@~57.0.30 --fix`) or moving up to NativeWind 5 when it
goes stable.

## The design system

`src/theme/tokens.js` is the **single source of truth**, transcribed from
`docs/13-design-and-brand.md` (rebranded 2026-10-15). Change the doc → change
that one file.

It's plain JavaScript because two consumers need it: `tailwind.config.js`
(CommonJS, read by Metro before any TypeScript exists) and `src/theme/index.ts`
(types + the seven composed text styles). One shared file means Tailwind classes
and StyleSheet objects can't disagree about what "signal teal" is.

```
src/theme/
├── tokens.js    ← source of truth: colors, radii, type scale, families
├── index.ts     ← typed exports + the 7 text styles + status pairs
└── fonts.ts     ← the 5 font faces, loaded in one place
```

Use Tailwind classes in markup; reach for the typed exports when a value must be
computed, animated, or handed to a native prop `className` can't reach
(Reanimated, gradients, StatusBar).

### Two naming traps, already handled

Tailwind resolves `text-*` against **both** fontSize and colors, and `font-*`
against **both** fontFamily and fontWeight. Two tokens collide with built-ins:

- **`text-base` is a font SIZE (16px), not the Midnight color.** For dark text
  on a teal button use the `onSignal` export via `style={{ color: onSignal }}`.
- **DM Sans Medium is keyed `strong`, not `medium`** — `font-medium` is already
  a built-in weight utility. Use `font-strong`.

Everything else is unambiguous: `bg-base`, `bg-surface`, `bg-elevated`,
`border-subtle`, `text-ivory`, `text-muted`, `bg-signal`, `text-signal-light`,
`text-gold`, plus `rounded-screen|card|input|pill` and `px-screen`.

Tailwind's default numeric spacing scale **is** the 4-point grid the doc asks
for (`p-1` = 4px, `p-5` = 20px), so it's extended rather than replaced.

### Theme proof sheet

`app/index.tsx` is a scaffold screen, not the real Home (that's screen 03, step
38). It renders every color token, all seven text styles and each corner radius
on one page, so the design system can be eyeballed the first time the app runs.
It also fails loudly: if NativeWind is misconfigured the page renders unstyled
instead of failing subtly three phases later. Delete it at step 38.

## Android permissions

`app.json` requests exactly what `docs/03-features-and-permissions.md` needs:
`RECORD_AUDIO`, `READ_CONTACTS`, `CALL_PHONE`, `SET_ALARM`, `CAMERA`,
`POST_NOTIFICATIONS`, `VIBRATE`.

It also sets **`blockedPermissions`** for `READ_SMS`, `SEND_SMS`,
`RECEIVE_SMS`, `READ_CALL_LOG` and `WRITE_CALL_LOG`. Asomi never asks for
these, but a transitive library can merge a permission into the manifest
without anyone noticing, and SMS permissions are a Play Store rejection —
`docs/11-deployment.md` has "No `READ_SMS`, `SEND_SMS` or Accessibility Service
in the manifest" on the launch checklist. Blocking them makes that
structurally true rather than something to remember to check.

`minSdkVersion` is 29 (Android 10), per the platform requirement in
`docs/02-product-requirements.md`.

## Still blocked: no JDK

`npx expo run:android` cannot compile on this machine. Present: Android SDK
34–37, build-tools 36.x, NDK, `adb`. Missing: a JDK — `C:\Program Files\Android`
is empty and there's no `java.exe` anywhere.

When you want to run on a device, pick one:

1. **Install Temurin JDK 17 or 21** and set `JAVA_HOME`. Everything else is
   already in place, so this is the only gap. Best for the Kotlin modules
   Asomi needs later (direct call, alarm, torch).
2. **EAS cloud build** — `eas build -p android --profile development`. No local
   JDK, but every Kotlin change costs a cloud build and a wait.

Expo Go won't work either way: Asomi needs native modules, so it requires a
development build.

## Backend contract

The Phase 1 backend is complete and tested. `POST /v1/command` takes a
transcribed command and returns `{ requestId, reply, actions }`, each action
carrying a server-set `risky` flag — `true` means this app must show a
confirmation card before running it. Full shape in `docs/07-api.md`.

Run the backend with `AI_PROVIDER=mock` to develop against it for free, with no
API key and no token spend:

```bash
cd ../backend && npm run dev
```

## Next: Phase 3

Steps 19–22 — `useVoice` with `expo-speech-recognition` (58.0.0 is published
and SDK-58 compatible), the animated MicButton, live transcript, and the
Hindi/English language switch.
