# SchoolWay — School Bus Administrator Dashboard

Browser-based React prototype for a school transport system. Includes role-based demo login for Administration, Driver, Teacher, and Conductor; an OpenStreetMap-powered map with simulated moving bus markers; an Add Student modal; student registry; trip roster; attendance view; alerts and event log.

## Run locally (important: don't double-click index.html)

Requires Node.js 18+ (Node.js 20+ recommended). This is a React/Vite app and must be served by Vite; opening `index.html` as a local file will not load the React dependencies and may appear blank.

**Windows:** double-click `run-windows.bat`, or use a terminal:

```bash
npm install
npm run dev
```

**macOS/Linux:** run `./run-mac-linux.sh`, or use the same commands above.

Open http://localhost:3009 and keep the terminal open while using the dashboard. If a React runtime error occurs, the app now shows an error screen rather than leaving a blank page. If you've run this app before and it behaves strangely, try a hard refresh (Ctrl+Shift+R) or clear site data for localhost.

## Demo login accounts

| Role | Username | Password |
|---|---|---|
| Administration | `admin` | `admin123` |
| Driver | `driver1` | `driver123` |
| Teacher | `teacher1` | `teacher123` |
| Conductor | `conductor1` | `conductor123` |

The login form shows clickable demo accounts. Role determines which navigation and actions are displayed.

## Features

- Administration: Overview, Live Fleet, Students/Add Student, Attendance, Staff & Roles, Alerts & Events.
- Driver: My Route, Live Fleet and trip roster.
- Teacher: overview, own class's students and attendance.
- Conductor: trip roster, simulated RFID boarding/deboarding events, attendance, live fleet and exception alerts.
- Map: OpenStreetMap tiles and demo markers that move every five seconds. Location coordinates are sample coordinates and **not real GPS**.
- Student and event data persist in the current browser via localStorage, for demo use only.

## Production security note

This is a front-end prototype. The username/password list and role checks live in browser JavaScript and are therefore not secure authentication or authorization. Do not use real student details or expose this directly to the public internet. For production, integrate Firebase Authentication (or a trusted identity provider), keep role assignments server-side (for example custom claims or a protected users collection), enforce Firestore Security Rules for each action, validate sensitive writes in a Cloud Function/backend, and use real GPS/IoT telemetry. Map tiles require internet access.
