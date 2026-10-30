# Push notifications — Client, Backend (Laravel), and Frontend (Expo)

This document is for **Tandil** (`com.tandilapp.tandil`). Today the app shows **in-app notifications** per role (polling while the app is open). The goal is **system push notifications** (lock screen / banner) when the user is logged in — **only for the role they are using**, not other roles.

---

## How it works (simple)

| Idea | Explanation |
|------|-------------|
| **One mobile app** | Same Tandil app for client, technician, vendor, etc. One Apple app, one Android app. |
| **Login = role session** | User logs in as **Client** → app uses client APIs and client notification list. User logs in as **Technician** → technician APIs, etc. |
| **Push follows the logged-in user** | Backend stores **Expo push token** linked to **user account** (and knows their role from auth). When something happens for that user (e.g. new order for a client), Laravel sends push **only to that user’s device token(s)**. |
| **Not “all roles at once”** | If you are logged in as **Client**, you do **not** get technician or admin pushes. Those go to other users who are logged in (or were registered) as those roles on **their** phones. |
| **Logout** | Frontend tells backend to remove/deactivate the push token on logout so old sessions do not receive pushes. |

```text
[Phone logged in as Client]
   → App gets ExpoPushToken → sends to Laravel with Bearer token (client login)
   → Laravel saves: user_id + expo_push_token
   → Event “client order update” → Laravel: DB notification + push to THAT user’s token(s) only

[Another phone logged in as Technician]
   → Different user (or same person different account) → different token
   → “Job assigned” → push only to technician user(s)
```

**Important:** Push is not configured “per role” in Apple/Google consoles. **Role filtering is done in Laravel** when deciding **who** gets each notification.

---

## What we need from the **Client** (Apple / Google access)

Right now **Apple Developer access is only with the client**. The client (or someone they appoint) must complete the items below and share files/access with the **frontend (Expo/EAS)** team. Backend does **not** need Apple certificates if you use **Expo Push Service** (recommended).

### Apple — certificates / keys (for iOS push)

Use an **APNs Auth Key (.p8)** — one key for the whole app (not per role).

| Item | What it is | Where client gets it |
|------|------------|----------------------|
| **Apple Developer Program** | Paid membership | [developer.apple.com](https://developer.apple.com) |
| **Team ID** | 10-character team id | Apple Developer → **Membership** |
| **App ID / Bundle ID** | Must be **`com.tandilapp.tandil`** | **Identifiers** → confirm **Push Notifications** capability is **ON** |
| **APNs Key (.p8)** | Push authentication key | **Certificates, Identifiers & Profiles** → **Keys** → **+** → enable **Apple Push Notifications service (APNs)** → download **`.p8` once** (cannot re-download) |
| **Key ID** | Shown when key is created | Same Keys page |
| **App Store Connect access** | For TestFlight / App Store | Client invites frontend Apple ID as **Developer** or **App Manager** if frontend uploads builds |

**Share securely with frontend team:**

- `.p8` file  
- **Key ID**  
- **Team ID**  
- Confirmation that **Push Notifications** is enabled on `com.tandilapp.tandil`

**Do not** commit `.p8` or passwords to Git.

### Android — Firebase (for Android push via Expo)

| Item | What it is |
|------|------------|
| **Firebase project** | Linked to package **`com.tandilapp.tandil`** |
| **`google-services.json`** | Download from Firebase → Project settings → Android app |

Share **`google-services.json`** with the frontend team for EAS builds.

### Expo / EAS (already in project)

| Item | Value (Tandil) |
|------|----------------|
| EAS Project ID | `ab7770a2-8b25-4bf7-b582-d7f34caa6238` (in `app.json` → `extra.eas.projectId`) |
| iOS bundle | `com.tandilapp.tandil` |
| Android package | `com.tandilapp.tandil` |

Client should **invite** the frontend developer to the **Expo organization/project** on [expo.dev](https://expo.dev) **or** upload APNs key in Expo dashboard under project **Credentials → iOS**.

---

## Steps the **Client** can do (Apple + TestFlight)

These steps assume the client holds the Apple account; frontend can guide remotely.

### A. Enable push on the App ID

1. Sign in to [Apple Developer](https://developer.apple.com/account).
2. **Certificates, Identifiers & Profiles** → **Identifiers** → select **`com.tandilapp.tandil`** (create if missing).
3. Enable **Push Notifications** → **Save**.

### B. Create APNs key (.p8)

1. **Keys** → **+** → name e.g. `Tandil APNs`.
2. Check **Apple Push Notifications service (APNs)**.
3. Continue → Register → **Download** `.p8` → note **Key ID**.
4. Send `.p8`, Key ID, and Team ID to frontend (secure channel).

### C. Upload credentials to Expo (client or frontend)

**Option 1 — Client on expo.dev:** Project **tandil** → **Credentials** → **iOS** → upload APNs key (.p8), Key ID, Team ID.

**Option 2 — Frontend via EAS CLI:** Client adds frontend to Expo project; frontend runs `eas credentials` (production profile uses local/remote per `eas.json`).

### D. TestFlight (client-friendly flow)

1. **App Store Connect** → **My Apps** → **Tandil** (create app if needed; bundle `com.tandilapp.tandil`).
2. Frontend runs **EAS Build** (`production` or `preview` iOS) and **EAS Submit** to TestFlight **or** client uploads IPA if you use their machine.
3. **TestFlight** → **Internal Testing** → add testers (client + team emails).
4. Testers install TestFlight app → accept invite → install **Tandil**.
5. **Push only works on a real iPhone** with a **development/production build** that includes `expo-notifications` (not old builds without push).

### E. Android internal test (optional parallel)

1. Firebase + `google-services.json` in repo (frontend).
2. EAS build APK/AAB → Play Console **Internal testing** track.

---

## **Backend (Laravel) developer** — what to do

Expo Push: Laravel calls **Expo’s HTTP API**; Expo talks to Apple (APNs) and Google (FCM). Backend does **not** need Apple `.p8` if Expo credentials are set on Expo/EAS side.

### 1. Database — store device tokens

Example table `device_push_tokens` (name can vary):

| Column | Notes |
|--------|--------|
| `user_id` | From authenticated user |
| `expo_push_token` | e.g. `ExponentPushToken[...]` — unique index |
| `platform` | `ios` / `android` |
| `revoked_at` | Set on logout or invalid token |

Optional: `app_version`, `last_seen_at`.

### 2. API endpoints (agree paths with frontend)

| Method | Purpose |
|--------|---------|
| `POST` (auth required) | Register or update token: body `{ "expo_push_token", "platform" }` |
| `DELETE` or `POST .../revoke` (auth required) | Remove token on logout |

Use the **same Bearer token** as existing role APIs (`/client/...`, `/technician/...`, etc.). Role is inferred from **authenticated user**, not from a separate “role” field on the token (unless you multi-role one account — then store `role` if product requires it).

### 3. Send push when creating in-app notifications

Wherever you already write **database notifications** for:

- Client → `/client/notifications`
- Vendor → `/vendor/notifications`
- Technician, Supervisor, Area Manager, HR, Admin → respective routes

**Add one step:**

1. Resolve recipient **user id(s)** (same logic as today — only users who should see this notification).
2. Load active `expo_push_token` for those users.
3. POST to Expo:

```text
POST https://exp.host/--/api/v2/push/send
Headers:
  Content-Type: application/json
  Accept: application/json
Body (single or array of messages):
  {
    "to": "ExponentPushToken[xxxxxxxx]",
    "title": "...",
    "body": "...",
    "data": { "type": "...", "id": "...", "audience_role": "client" },
    "sound": "default",
    "priority": "high"
  }
```

Use the same **title / message / type** as in notification `data` so the app can open the correct screen when the user taps the push.

**Admin broadcast by role** (`POST /admin/notifications/broadcast` with `type=role`): send push to all users with that **role** who have tokens — same audience as in-app broadcast.

### 4. Handle failures

If Expo returns **DeviceNotRegistered** or invalid token → delete or revoke that row in `device_push_tokens`.

Optional: store Expo **ticket id** and poll [push receipts](https://docs.expo.dev/push-notifications/sending-notifications/#push-receipts) for analytics (align with existing `GET /admin/notifications/delivery-stats` if desired).

### 5. Laravel implementation options

- Small service class `ExpoPushService` using `Http::post(...)`, **or**
- Community package e.g. `laravel-notification-channels/expo` (verify maintained for current Expo API).

### 6. What backend should **not** do

- Do not send push to “all tokens in DB” for every event — always filter by **recipient user** / **role audience** (same as in-app).
- Do not expose push tokens in public APIs.

### 7. Handoff to frontend (backend provides)

| Deliverable | Description |
|-------------|-------------|
| **API contract** | Exact URLs, request/response JSON, error codes |
| **Postman examples** | Register token, sample push trigger (or test route behind admin) |
| **`data` payload schema** | Fields for deep link: `type`, ids, `audience_role` — match existing notification rows |

---

## **Frontend (Expo) developer** — your role

You own everything **inside the mobile app** and **EAS builds**. You coordinate with client for Apple/Firebase and with backend for APIs.

### Your checklist

| # | Task |
|---|------|
| 1 | Add **`expo-notifications`** (and config plugin in `app.config.js`). |
| 2 | On **login success** (each role flow): request permission → `getExpoPushTokenAsync({ projectId })` using `extra.eas.projectId` from `app.json`. |
| 3 | **POST** token to Laravel register endpoint (authenticated). |
| 4 | On **logout**: call revoke endpoint. |
| 5 | Listen for **notification tap** → navigate using same rules as in-app notifications (`notificationRouteUtils`, `data.type`). |
| 6 | Optional: reduce **30s polling** (`useNotificationAlerts`) once push is stable; keep in-app list as today. |
| 7 | Add **`google-services.json`** for Android when client provides it. |
| 8 | Run **new EAS iOS/Android builds** after native changes; distribute TestFlight / internal APK. |
| 9 | Test with [Expo push notification tool](https://expo.dev/notifications) using a real device token from a test build. |

### What you ask from **client**

- APNs `.p8`, Key ID, Team ID  
- Push enabled on App ID `com.tandilapp.tandil`  
- Expo project access or they upload APNs to Expo  
- App Store Connect / TestFlight tester invites if needed  
- `google-services.json` for Android  

### What you ask from **backend**

- Register + revoke token API URLs and payloads  
- Confirmation push is sent on the same events as in-app notifications per role  
- Sample `data` JSON for each notification `type` you must handle on tap  
- Staging environment to test without spamming production users  

### What you tell **client** (one sentence)

> “When someone logs in as Client on their phone, only that account’s alerts are sent to that phone; Technician alerts go to technicians’ phones — Apple does not split this by role, our server does.”

---

## Suggested order of work

1. **Client:** App ID push ON + APNs `.p8` + Firebase `google-services.json` + Expo access.  
2. **Frontend:** Install notifications package, register token API integration (can mock backend briefly).  
3. **Backend:** Token table + register/revoke + send on one notification type (pilot).  
4. **Frontend + Backend:** End-to-end test on TestFlight device (client login → trigger event → push appears).  
5. **Backend:** Hook all role notification creators + admin broadcast.  
6. **Frontend:** Tap routing + logout revoke + production build.

---

## Useful links

- [Expo Push Notifications overview](https://docs.expo.dev/push-notifications/overview/)  
- [Sending notifications (Expo HTTP API)](https://docs.expo.dev/push-notifications/sending-notifications/)  
- [FCM credentials for Expo](https://docs.expo.dev/push-notifications/fcm-credentials/)  
- [Expo push notifications tool (test send)](https://expo.dev/notifications)  

---

## Current app reference (Tandil)

| Item | Value |
|------|--------|
| In-app notifications today | Per-role API lists + polling ~30s when app open (`roleNotificationAlerts.ts`, `useNotificationAlerts.ts`) |
| Push package today | **Not installed yet** — required for system push |
| EAS Project ID | `ab7770a2-8b25-4bf7-b582-d7f34caa6238` |
| iOS bundle / Android package | `com.tandilapp.tandil` |

---

*Last updated for push rollout planning. Share this file with client and Laravel developer.*
