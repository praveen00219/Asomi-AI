# Asomi – frontend

Placeholder. The Expo / React Native app lands here in **Phase 2** of
`project_planning/docs/08-roadmap-and-build-steps.md` (steps 15–18).

## Blocked on a JDK

The development build cannot be compiled on this machine yet. What's already in
place:

- Android SDK at `C:\Users\YOGA\AppData\Local\Android\Sdk`
- Platforms 34, 35, 36, 36.1, 37.0 · build-tools 36.0.0, 36.1.0 · NDK · `adb`

What's missing:

- **A JDK.** `C:\Program Files\Android` is empty and no `java.exe` exists
  anywhere on the system, so `npx expo run:android` fails at the Gradle step.

Two ways forward, to be decided before Phase 2 starts:

1. **Install Temurin JDK 17 or 21** and set `JAVA_HOME`. Everything else is
   already installed, so `npx expo run:android` then works as the docs assume.
   Fastest native-module iteration, which matters because Asomi needs Kotlin
   modules for direct calls, alarms and the torch.
2. **EAS cloud builds** — `eas build -p android --profile development`. No local
   JDK needed, but every Kotlin change costs a cloud build and a wait.

Expo Go will not work either way: Asomi needs native modules, so it requires a
development build (see `project_planning/CLAUDE.md`).

## Planned structure

Per `project_planning/docs/05-architecture-and-tech-stack.md`:

```
frontend/
├── app/            # Expo Router screens: (onboarding), (tabs), paywall
├── src/
│   ├── actions/    # one file per tool: call.ts, alarm.ts, gmail.ts ...
│   ├── components/ # MicButton, ActionCard, Waveform
│   ├── hooks/      # useVoice, useCommand
│   ├── lib/        # api.ts, google.ts, storage.ts
│   ├── store/      # zustand stores
│   └── theme/      # Midnight / Signal teal / Ivory tokens, Sora + DM Sans
├── modules/        # Kotlin: alarm, call, torch
└── assets/
```

## Contract it builds against

The backend is live now. `POST /v1/command` takes a transcribed command and
returns `{ requestId, reply, actions }`, where each action carries a server-set
`risky` flag — `true` means the app must show a confirmation card before running
it. Full shape in `project_planning/docs/07-api.md`; run the server with
`AI_PROVIDER=mock` to develop against it without spending tokens.
