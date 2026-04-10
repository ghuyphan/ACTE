# Project Audit - 2026-04-10

## Scope

This audit tracks a full-repo review of the Noto Expo / React Native project.

Status legend:

- `OPEN`: confirmed issue, not fixed yet
- `IN PROGRESS`: fix underway
- `FIXED`: code change landed locally
- `VERIFIED`: fix landed and relevant checks passed
- `NEEDS FOLLOW-UP`: valid issue, but verification or broader design follow-up is still needed

## Audit Streams

| Stream | Scope | Status |
| --- | --- | --- |
| A1 | Routes and screen entry points | Auditing |
| A2 | Home / notes / detail UI | Auditing |
| A3 | Hooks and state management | Auditing |
| A4 | Services and persistence | Auditing |
| A5 | Map / geofence / widgets / native-sensitive code | Auditing |
| A6 | Tests and coverage quality | Auditing |
| A7 | Config / startup / localization | Pending |
| A8 | Auth / friends / shared / settings / plus flows | Pending |
| Local verification | Lint, typecheck, jest | Running |

## Findings

No findings logged yet. This file will be updated as each audit stream completes.

## Verification

- `npm run lint`: running
- `npm run typecheck`: running
- `npm test -- --runInBand`: running
