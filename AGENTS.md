# AGENTS.md — Rules for AI coding agents working on the SelfPhoneNG mobile app

The spec lives in the PBX repo: read `vendor/selfphoneng/AGENTS.md`, then
`vendor/selfphoneng/docs/spec/13-mobile.md` (this app), and `04-backend-api.md` for the API.
Tasks are MB3–MB8 in 13 §5: one at a time, as the PBX's hard rules say.

## Expo changes fast: don't trust memory

Read the `expo` major in `package.json`, then the matching docs
(`https://docs.expo.dev/versions/v<major>.0.0/`, or Context7). Add packages with
`npx expo install <package>` (SDK-compatible versions), never `npm install` for Expo or React
Native packages.

## Rules

- Routes are in `src/app/` (Expo Router); everything else in `src/`.
- `android/` and `ios/` are generated (`npx expo prebuild`): never edit or commit them. Native
  settings go in `app.json` and config plugins.
- API types come from `@selfphoneng/shared` (the submodule) with `import type` only, so Metro never
  bundles the PBX's code. Don't redefine a type the PBX already exports.
- Every source file starts with `// SPDX-License-Identifier: AGPL-3.0-or-later`.
- Open source only (PBX hard rule 4). New dependencies are listed in 13 §1 with the reason.
- Never log the device token, SIP password or voicemail audio.

## Git: GitHub first, then git.dou.bet

GitHub (`origin`, `github.com/iamdoubz/selfphoneng-mobile`) is the main repo: the iOS builds
(`builder`) run there. git.dou.bet (`dou`, `git.dou.bet/spng/mobile`) is a backup.

1. Commit on a new branch, never on `main`.
2. Push the branch to GitHub: `git push -u origin <branch>`.
3. Then to git.dou.bet: `git push dou <branch>`.
4. The pull request is opened and merged on GitHub.
5. Pull `main` from GitHub, then `git push dou main`; delete the merged branch.

Never `--force` or `--mirror`, and no push mirror between the two: a Gitea push mirror once
overwrote GitHub, deleting its branches and commits.

## Before saying a task is done

```bash
npm run typecheck && npm run lint && npx expo export --platform android --platform ios
```
