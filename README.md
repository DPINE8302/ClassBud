# ClassBud 2.0

ClassBud is an offline-first timetable and study companion for the M.5 Innovative Multimedia Technology program, Semester 1/2569 (2026).

## Features

- Exact Tuesday–Friday timetable with Day, Week, and Month views
- Current-class timeline, upcoming classes, rooms, teachers, and learning mode
- Tasks and per-subject notes saved locally
- Bilingual Thai/English offline Buddy assistant
- Safe v1 migration with downloadable legacy backup
- System, light, and dark themes
- Installable PWA with offline app shell
- Responsive desktop inspector, tablet split view, and phone navigation

## Development

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run check       # Netlify gate: lint, types, unit tests, build, artifact checks
npm run check:full  # Local release gate: deploy gate plus cross-browser E2E
```

Production output is written to `dist/`. Netlify configuration includes the SPA rewrite, cache policy, and security headers.

## Data and privacy

ClassBud has no account, backend, analytics, or AI service. Schedule, tasks, notes, theme, and reminder preference stay in browser storage. Export creates a validated ClassBud v2 JSON backup.

Class reminders work while ClassBud is open. Closed-app delivery is not promised.

## Version

`2.0.0` · schedule schema `m5-im-s1-2569`

Created by [Win (Wiqnnc_)](https://github.com/wiqnnc).
