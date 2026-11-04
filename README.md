# Field Reports Server

Backend for the Field Reports mobile app: **Node + Express + Supabase (Postgres + Storage) + JWT**.

It is built around one idea: **every write is idempotent**. The mobile app generates the UUIDs for
reports and images, so a request that is retried (after a dropped connection, a lost response, a
force-quit) can never create a duplicate and can never be "half applied" in a way the next attempt
cannot finish.

> The assessment brief says "no login". JWT auth here is an addition, so a deployed backend is not an
> open file dump. The mobile app has to sign in once and send the token.

---

## Contents

1. [Quick start](#quick-start)
2. [Supabase setup](#supabase-setup)
3. [Environment variables](#environment-variables)
4. [Folder structure](#folder-structure)
5. [API reference](#api-reference)
6. [How idempotency works](#how-idempotency-works)
7. [Making the server fail on demand](#making-the-server-fail-on-demand)
8. [Postman](#postman)
9. [Connecting the mobile app](#connecting-the-mobile-app)
10. [Design decisions](#design-decisions)
11. [Known gaps / what I'd do with another day](#known-gaps)

---

## Quick start

Requires Node 18+.

```powershell
cd server
npm install
copy .env.example .env      # then fill it in (see below)
npm run dev                 # auto-restart on change
# or: npm start
```

Check it is alive: <http://localhost:3000/health>

If a required variable is missing the server refuses to start and lists exactly which ones.

## Supabase setup

1. Create a project at <https://supabase.com> (free tier is enough).
2. **Tables + bucket:** Dashboard -> *SQL Editor* -> *New query* -> paste `supabase/schema.sql` -> *Run*.
   This creates `users`, `reports`, `report_images`, turns on RLS, and creates a **private** bucket
   named `report-images` (5 MB limit, JPEG only).
3. **Keys:** Dashboard -> *Project Settings* -> *API*. Copy:
   - *Project URL* -> `SUPABASE_URL`
   - *service_role* key -> `SUPABASE_SERVICE_ROLE_KEY`
4. Generate the secrets:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # use for JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # use for ADMIN_KEY
   ```

> The **service_role** key bypasses all Row Level Security. It lives in the server's `.env` only.
> Never put it in the mobile app, a repo, or a screenshot. RLS is enabled with no policies, so the
> public `anon` key can read and write nothing; all access goes through this API.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `NODE_ENV` | no | `development` | |
| `SUPABASE_URL` | yes | | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | | Server-side key (secret) |
| `SUPABASE_BUCKET` | no | `report-images` | Storage bucket name |
| `JWT_SECRET` | yes | | >= 32 chars, signs tokens |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime (`15m`, `12h`, `7d`...) |
| `ADMIN_KEY` | yes | | Header `x-admin-key` for `/api/admin/*` |
| `MAX_IMAGE_BYTES` | no | `5242880` | Per-image ceiling (5 MB) |
| `SIGNED_URL_TTL_SECONDS` | no | `3600` | Lifetime of image URLs |
| `CORS_ORIGIN` | no | `*` | Comma-separated origins, or `*` |

## Folder structure

```
server/
├── package.json
├── .env.example               copy to .env
├── supabase/
│   └── schema.sql             tables, indexes, RLS, private bucket
├── postman/
│   ├── FieldReports.postman_collection.json
│   └── FieldReports.local.postman_environment.json
└── src/
    ├── server.js              starts HTTP (timeouts, graceful shutdown)
    ├── app.js                 builds the Express app (security, parsers, routes, errors)
    ├── config/
    │   ├── env.js             validated environment (fails fast)
    │   └── supabase.js        service-role client
    ├── routes/                URL -> middleware chain -> controller
    │   ├── index.js
    │   ├── auth.routes.js
    │   ├── report.routes.js   chaos -> auth -> validate -> controller
    │   └── admin.routes.js
    ├── controllers/           HTTP in/out only, no SQL
    │   ├── auth.controller.js
    │   ├── report.controller.js
    │   ├── image.controller.js
    │   └── admin.controller.js
    ├── models/                the ONLY place that talks to Supabase tables
    │   ├── user.model.js
    │   ├── report.model.js
    │   └── image.model.js
    ├── services/
    │   ├── storage.service.js Supabase Storage (upload, signed URLs, delete)
    │   └── chaos.service.js   failure-injection state
    ├── middleware/
    │   ├── auth.js            verifies the JWT
    │   ├── adminAuth.js       verifies x-admin-key
    │   ├── chaos.js           injects latency/drops/errors/hangs
    │   ├── validate.js        zod validation
    │   ├── requestLogger.js
    │   ├── notFound.js
    │   └── errorHandler.js    one consistent error shape
    ├── validators/            zod schemas
    └── utils/                 ApiError, asyncHandler, token, password, serializers, imageCheck, db
```

Request flow for an image upload:
`routes -> chaos -> requireAuth -> validate(params) -> raw body parser (5 MB cap) -> image.controller -> models + storage.service`

## API reference

Base URL: `http://localhost:3000`. JSON everywhere except the image upload.
Authenticated endpoints need `Authorization: Bearer <token>`.

### Auth

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password (8-72), name }` | `201 { token, tokenType, expiresIn, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { token, ... }` |
| GET | `/api/auth/me` | | `200 { user }` |
| POST | `/api/auth/refresh` | | `200 { token, ... }` (needs a still-valid token) |

### Reports (all idempotent)

| Method | Path | Notes |
|---|---|---|
| PUT | `/api/reports/:reportId` | Body `{ description, imageIds: [1..5 unique uuids] }`. `201` first time, `200` on repeat. A committed report is returned unchanged. |
| PUT | `/api/reports/:reportId/images/:imageId` | Body = **raw JPEG bytes**, `Content-Type: image/jpeg`. Max 5 MB. Same id again overwrites. |
| GET | `/api/reports/:reportId` | Status + `receivedImageIds`. The app uses this to resume. |
| POST | `/api/reports/:reportId/commit` | `200` when every image has arrived (and on repeat). `409 IMAGES_MISSING { missing: [...] }` otherwise. |
| GET | `/api/reports?limit=50&before=<committedAt>` | Committed reports of the signed-in user, newest first, with signed image URLs. `nextBefore` for paging. |

`reportId` and `imageId` are UUIDs **generated by the client**.

### Admin (header `x-admin-key`)

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/admin/chaos` | Read / change failure injection |
| GET | `/api/admin/stats` | Counts of reports and uploaded images |
| POST | `/api/admin/reset` | Delete all reports, images and stored files (users kept) |

### Errors

Every error has the same shape:

```json
{ "error": { "code": "IMAGES_MISSING", "message": "Some images have not been uploaded yet", "details": { "missing": ["..."] } } }
```

| Status | Codes | Should the app retry? |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `EMPTY_BODY`, `MALFORMED_JSON` | No (fix the request) |
| 401 | `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS` | **No, but do not fail the report.** Pause the queue and re-authenticate. |
| 404 | `REPORT_NOT_FOUND`, `ROUTE_NOT_FOUND` | Re-send step 1 (`PUT /reports/:id`), then continue |
| 409 | `REPORT_ID_TAKEN`, `IMAGE_ID_TAKEN`, `IMAGE_NOT_IN_REPORT` | No |
| 409 | `IMAGES_MISSING` | Yes: upload the missing images, then commit again |
| 413 | `IMAGE_TOO_LARGE`, `PAYLOAD_TOO_LARGE` | No (client bug: compress harder) |
| 422 | `NOT_JPEG`, `CHAOS_UPLOAD_REFUSED` | No |
| 408 / 429 / 5xx | `STORAGE_ERROR` (502), `DB_ERROR` (500), `CHAOS` | **Yes**, with backoff |

## How idempotency works

The upload is three idempotent steps, so any step can be repeated safely, in any order of failure:

1. `PUT /reports/:id` is an upsert keyed on the client's UUID. Repeating it changes nothing.
2. `PUT /reports/:id/images/:imageId` writes to the deterministic path
   `<userId>/<reportId>/<imageId>.jpg` with `upsert: true`. Repeating it overwrites the same file,
   so there is never a second copy.
3. `POST /reports/:id/commit` flips `pending -> committed` only if every image exists, and only if
   the report is still `pending`. Repeating it returns the same result.

The case that matters most is the **lost response**: the server did the work, the phone never heard
back, so the phone retries. Every step above treats that retry as a no-op. Use
`loseResponseRate` (below) to prove it.

A report only becomes visible in `GET /reports` once committed, so a half-uploaded report is never
shown as "uploaded".

## Making the server fail on demand

Settings are in memory (they reset when the server restarts) and only affect `/api/reports/*`.
They run **before** authentication, so they behave like a bad network.

| Setting | Effect |
|---|---|
| `latencyMs` | Every request waits this long first |
| `hangRate` (0..1) | Never answers; the client must time out |
| `dropRate` (0..1) | Connection killed **before** any work |
| `errorRate` + `errorStatus` | Answers with that status before any work (5xx/408/429 = retryable, 4xx = permanent) |
| `loseResponseRate` (0..1) | Work is **done**, then the connection is killed instead of answering |
| `rejectUploads` | Image PUTs answer 422 |
| `reset: true` | Back to normal |

```powershell
$h = @{ "x-admin-key" = "YOUR_ADMIN_KEY"; "Content-Type" = "application/json" }

# lose half of all responses
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/admin/chaos -Headers $h -Body '{"loseResponseRate":0.5}'

# return 503 for everything (retryable)
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/admin/chaos -Headers $h -Body '{"errorRate":1,"errorStatus":503}'

# back to normal
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/admin/chaos -Headers $h -Body '{"reset":true}'

# how many reports/images does the server hold?
Invoke-RestMethod -Uri http://localhost:3000/api/admin/stats -Headers $h
```

After a test run, `stats` must show each report and image **exactly once**.
Every injected failure is also printed in the server console (`[chaos] ...`).

For a slow link (2G) use the phone/emulator network throttle; the server does not throttle bytes itself.

## Postman

1. Import both files from `postman/` (collection + environment) and select the *Field Reports - Local* environment.
2. Set `adminKey` in the environment.
3. Run **Auth -> Register**, then **Auth -> Login** (stores `{{token}}`; every other request uses it).
4. Run **Reports (upload flow)** top to bottom. For the two upload requests pick a small `.jpg`
   under *Body -> binary*. Steps 6 and 7 re-send commit/create and must still succeed without duplicates.
5. **Validation & errors** covers blank description, 0 and 6 images, missing token, non-JPEG.
6. **Admin & failure injection** switches the failure modes on and off.

The collection has test scripts, so *Run collection* gives a quick pass/fail check.

## Connecting the mobile app

| App runs on | Base URL |
|---|---|
| Android emulator | `http://10.0.2.2:3000` |
| Physical phone over USB | `adb reverse tcp:3000 tcp:3000`, then `http://localhost:3000` |
| Physical phone over Wi-Fi | `http://<laptop-LAN-IP>:3000` |

Android blocks plain HTTP by default: for local dev add `android:usesCleartextTraffic="true"` to
`AndroidManifest.xml` (development only; use HTTPS when deployed).

Order of calls for one report: **PUT report -> PUT each image (raw bytes) -> POST commit**.
On resume, `GET /reports/:id` says which images are already there so they are skipped.

## Design decisions

- **Client-generated UUIDs as primary keys.** The idempotency key is the identity itself; no separate
  "request id" table to keep in sync.
- **Three small steps instead of one multipart request.** A 2G connection drops constantly; per-image
  requests mean a failure costs one image, not the whole report, and progress survives.
- **Raw JPEG body, not multipart.** No multipart parser, a hard byte limit enforced by the body parser
  before the data is buffered, simple resume.
- **Server never trusts the client's 5 MB claim.** It enforces the ceiling itself (bucket limit,
  parser limit, check constraint). The app must still compress; this is the safety net.
- **Models own all database access; controllers own HTTP.** Controllers never build a query, models
  never touch `req`/`res`. Easy to unit test and to swap Supabase out.
- **Service-role key + our own users table**, not Supabase Auth: the brief asked for JWT, and it keeps
  the token logic visible. Ownership is checked in code on every query (and other users' reports
  answer 404, not 403, so ids cannot be probed).
- **Private bucket + signed URLs** so images are not world-readable.
- **`server.requestTimeout = 0`.** Node's default 5-minute request limit would cut off a slow upload;
  the client sets its own timeouts instead.
- **Failure injection lives in the server, behind an admin key**, so it can be flipped live while the
  app is mid-upload.

## Known gaps

What I knowingly left out, and what I'd do next:

- **Never run against a live Supabase project from this repo's author sandbox** (no network there):
  syntax is checked, the flow is designed to be verified with the Postman collection. Run the
  collection once after setup.
- **No automated tests.** Next: Jest + supertest with the model layer faked, covering retry/duplicate cases.
- **Resumable uploads.** One PUT per image is fragile on 2G: a 5 MB file at ~3 KB/s takes about 30
  minutes. Mitigations today: the app compresses well under 5 MB and uses size-aware timeouts. Next:
  chunked upload with byte-range resume (or Supabase's TUS endpoint).
- **JWT vs long offline stretches.** A 7-day token can expire while the phone is offline. The app must
  treat `401` as "pause and re-login", never as a permanent failure. Next: refresh tokens.
- **No rate limiting / brute-force protection** on login, no email verification, no password reset.
- **Not atomic across Postgres and Storage.** A crash between "file stored" and "row updated" leaves a
  file the row does not know about; the retry fixes it (same path, `upsert`), and an orphan would be
  cleaned by a periodic job (not written).
- **Chaos settings are per-process memory**, fine for one instance, wrong behind a load balancer.
- No pagination cursor stability for identical `committed_at` timestamps.
