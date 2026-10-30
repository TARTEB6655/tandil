# Tandil mobile push notifications — Laravel backend guide

**Audience:** Laravel / API developer  
**Mobile app:** Expo (React Native), bundle `com.tandilapp.tandil`  
**API base (production):** `https://app.tandil.ae/api`  
**Goal:** When the app already creates **database notifications** (in-app list per role), also send **Expo push notifications** to the recipient’s phone (lock screen / banner).

You **do not** need Apple APNs certificates or Firebase keys on the server if you use **Expo Push Service**. The mobile team configures APNs/FCM on Expo/EAS; Laravel only calls Expo’s HTTP API.

---

## 1. Behaviour (role-based delivery)

| Rule | Detail |
|------|--------|
| One app, many roles | Client, vendor, technician, supervisor, area manager, HR, admin use the **same** app with different login flows. |
| Push target = **user**, not “all roles” | Store `expo_push_token` per **authenticated user** (and device). When an event targets user `#123`, send push only to tokens for `#123`. |
| Same audience as in-app | If a notification appears in `GET /client/notifications` for that user, they should get the same push. If it is for a technician, only that technician user(s) — not someone logged in as client on another account. |
| Logout | Mobile app will call a **revoke** endpoint so stale tokens do not receive pushes. |

Role is determined by **who receives the Laravel notification** (not by a separate Apple “channel”). Admin broadcasts already support `type=all|role|users` on `POST /admin/notifications/broadcast` — push audience must match that logic.

---

## 2. What already exists in the app (your notification APIs)

The mobile app reads Laravel **database notifications** from these routes (Bearer token per role):

| Role | List endpoint (examples) |
|------|---------------------------|
| Client | `GET /client/notifications` |
| Vendor | `GET /vendor/notifications` |
| Technician | `GET /technician/notifications` |
| Supervisor | `GET /supervisor/notifications` |
| Area manager | `GET /area-manager/notifications` |
| HR | `GET /hr/notifications` |
| Admin / hub | `GET /admin/notifications`, `GET /notifications` |
| User (legacy) | `GET /user/notifications` |

Notification row shape (typical): `id`, `type`, `data` (JSON with `title`, `message`, `type`, optional ids like `report_id`, `visit_id`), `read_at`, `created_at`.

Admin:

- `POST /admin/notifications/broadcast` — form: `title`, `message`, `type` (`all` \| `role` \| `users`), optional `role`, `user_ids[]`
- `GET /admin/notifications/delivery-stats` — delivery analytics (optional: extend for push sent/failed)

**Your task:** hook **push send** at the same place(s) you persist these notifications (or via Laravel `Notification` channel / observer), without changing list API contracts unless you add new endpoints below.

---

## 3. New work — device token storage

### 3.1 Suggested migration

Table name example: `device_push_tokens`

```php
Schema::create('device_push_tokens', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('expo_push_token')->unique();
    $table->enum('platform', ['ios', 'android']);
    $table->timestamp('last_used_at')->nullable();
    $table->timestamp('revoked_at')->nullable();
    $table->timestamps();

    $table->index(['user_id', 'revoked_at']);
});
```

- One user may have **multiple devices** → multiple rows.
- Upsert on register: same `expo_push_token` → update `user_id` if needed, clear `revoked_at`, set `last_used_at`.

### 3.2 Register / revoke API (coordinate exact paths with mobile team)

Suggested (auth middleware same as existing API):

| Method | Path (suggestion) | Body | Action |
|--------|-------------------|------|--------|
| `POST` | `/device-push-tokens` | `{ "expo_push_token": "ExponentPushToken[...]", "platform": "ios" \| "android" }` | Upsert for `auth()->id()` |
| `POST` | `/device-push-tokens/revoke` | `{ "expo_push_token": "..." }` optional; if omitted revoke all for user | Set `revoked_at` |

Response example:

```json
{
  "success": true,
  "message": "Token registered."
}
```

Validation:

- `expo_push_token` must match Expo format (starts with `ExponentPushToken[` or `ExpoPushToken[` per current Expo docs).
- Reject unauthenticated requests.

**Please document final URLs in Postman** and share with frontend.

---

## 4. Sending push via Expo HTTP API

### 4.1 Endpoint

```http
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json
Accept: application/json
Accept-Encoding: gzip, deflate
```

Optional header (Expo access token — only if you enable push security in Expo dashboard):

```http
Authorization: Bearer <EXPO_ACCESS_TOKEN>
```

### 4.2 Single message body

```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Order update",
  "body": "Your order #4521 has been confirmed.",
  "sound": "default",
  "priority": "high",
  "data": {
    "type": "order_confirmed",
    "notification_id": "550e8400-e29b-41d4-a716-446655440000",
    "audience_role": "client",
    "order_id": 4521
  }
}
```

- **`title` / `body`:** Shown on lock screen; mirror `data.title` / `data.message` from DB notification when possible.
- **`data`:** Must be JSON-serializable; mobile uses it for **tap → navigate**. Keep keys aligned with existing in-app notification `data` (`type`, ids, etc.).

### 4.3 Batch (max 100 messages per request)

Send an **array** of message objects:

```json
[
  { "to": "ExponentPushToken[aaa]", "title": "...", "body": "...", "data": {} },
  { "to": "ExponentPushToken[bbb]", "title": "...", "body": "...", "data": {} }
]
```

For a broadcast to many users: load tokens → chunk by 100 → POST each chunk.

### 4.4 Example service (Laravel)

```php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Collection;

class ExpoPushService
{
    private const SEND_URL = 'https://exp.host/--/api/v2/push/send';

    /**
     * @param  Collection<int, string>  $expoPushTokens
     * @param  array<string, mixed>  $data  Deep-link payload for mobile
     */
    public function sendToTokens(
        Collection $expoPushTokens,
        string $title,
        string $body,
        array $data = [],
    ): void {
        $messages = $expoPushTokens->unique()->values()->map(fn (string $to) => [
            'to' => $to,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'priority' => 'high',
            'data' => $data,
        ])->all();

        foreach (array_chunk($messages, 100) as $chunk) {
            $response = Http::acceptJson()
                ->asJson()
                ->post(self::SEND_URL, $chunk);

            if (!$response->successful()) {
                // log $response->body()
                continue;
            }

            $this->handleSendResponse($response->json());
        }
    }

    private function handleSendResponse(array|null $json): void
    {
        $items = $json['data'] ?? [];
        if (!is_array($items)) {
            return;
        }

        foreach ($items as $item) {
            $status = $item['status'] ?? null;
            if ($status === 'error') {
                $details = $item['details'] ?? [];
                $error = $details['error'] ?? null;
                // DeviceNotRegistered → revoke token in DB
                if ($error === 'DeviceNotRegistered') {
                    $token = $item['message'] ?? null; // Expo may return token in message field depending on version
                    // Prefer matching 'to' from your outbound map; store ticket→token if needed
                }
            }
        }
    }
}
```

Refine error handling using [Expo push ticket / receipt docs](https://docs.expo.dev/push-notifications/sending-notifications/). On **`DeviceNotRegistered`**, set `revoked_at` on that `expo_push_token`.

---

## 5. Where to integrate in Laravel

Recommended options (pick one consistent pattern):

1. **Custom notification channel** — `ExpoPushChannel` invoked from existing Laravel `Notification` classes after `database` channel.
2. **Observer on `DatabaseNotification`** — after create, resolve notifiable user → tokens → send.
3. **Central helper** — e.g. `PushNotificationDispatcher::send(User $user, string $title, string $body, array $data)` called from all domain events that already notify.

Flow:

```text
Business event
  → Create DB notification (existing)
  → Resolve notifiable user id(s)
  → Query device_push_tokens where user_id in (...) and revoked_at is null
  → ExpoPushService::sendToTokens(...)
```

### 5.1 Admin broadcast

On `POST /admin/notifications/broadcast`:

| `type` | Push recipients |
|--------|-----------------|
| `all` | All users with active tokens (same as in-app audience) |
| `role` | Users with that role + active tokens |
| `users` | `user_ids[]` + active tokens |

Use the same title/message as stored in broadcast / per-user notification rows.

### 5.2 Optional: delivery stats

If you expose `GET /admin/notifications/delivery-stats`, consider counters:

- `push_sent`, `push_failed`, `push_no_token` (in-app only)

Optional table `push_delivery_logs` (notification_id, expo_ticket_id, status) for receipts polling.

---

## 6. `data` payload contract (for mobile tap handling)

Agree with frontend on stable keys. Suggested minimum:

| Field | Purpose |
|-------|---------|
| `type` | Same as in-app `data.type` (routing) |
| `notification_id` | DB notification id (mark read after open) |
| `audience_role` | `client`, `technician`, `vendor`, `supervisor`, `area_manager`, `hr`, `admin` |
| Domain ids | e.g. `order_id`, `report_id`, `visit_id` — copy from existing notification `data` |

Example aligned with client notifications:

```json
{
  "type": "admin_notification",
  "notification_id": "9d5f1a2b-3c4d-5e6f-7890-abcdef123456",
  "audience_role": "client",
  "title": "Maintenance visit scheduled",
  "message": "Your visit is confirmed for tomorrow."
}
```

Publish a short table of `type` values the app handles (frontend can share from `notificationRouteUtils`).

---

## 7. Security & operations

- Register/revoke endpoints: **authenticated only**; token row always tied to `auth()->id()`.
- Do not return other users’ push tokens in admin APIs.
- Rate-limit register endpoint if needed (token refresh on each app open).
- Queue heavy broadcasts: `SendExpoPushBatch` job with retries.
- Log failures; do not fail the main HTTP request if Expo is down (in-app notification still works).

Environment:

```env
# Optional, only if Expo project requires access token for push API
EXPO_ACCESS_TOKEN=
```

---

## 8. Testing checklist

1. **Register:** Mobile login → `POST` token → row in DB for correct `user_id`.
2. **Single user:** Trigger one notification type → one device receives push; DB row unchanged for list APIs.
3. **Role isolation:** User A (client) does not receive User B (technician) push.
4. **Logout:** Revoke → subsequent push to that token does not deliver (or Expo returns DeviceNotRegistered).
5. **Broadcast:** `type=role` with `role=technician` → only technician tokens.
6. **Manual:** [Expo push tool](https://expo.dev/notifications) with a real `ExponentPushToken[...]` from mobile team (validates Expo/APNs/FCM on their side).

Pilot: implement **one** notification type end-to-end before wiring all roles.

---

## 9. Coordination with mobile (frontend) team

They will:

- Install `expo-notifications`, obtain `ExponentPushToken[...]` using EAS project id `ab7770a2-8b25-4bf7-b582-d7f34caa6238`
- Call your **register** API after login and **revoke** on logout
- Handle notification **tap** using `data` you send

**They need from you:**

| Deliverable | Status |
|-------------|--------|
| Final register + revoke URLs and JSON schema | ☐ |
| Postman collection or examples | ☐ |
| Confirmation push fires on same events as in-app (per role) | ☐ |
| Documented `data.type` values and extra fields | ☐ |
| Staging base URL for testing | ☐ |

---

## 10. References

- [Expo — Push notifications overview](https://docs.expo.dev/push-notifications/overview/)
- [Expo — Sending notifications (HTTP API, tickets, receipts)](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo push notification tool](https://expo.dev/notifications)

---

## 11. Suggested implementation order

1. Migration + model `DevicePushToken`
2. Register / revoke API + Postman
3. `ExpoPushService` + one notification path (pilot)
4. Wire all DB notification creation paths + admin broadcast
5. Token cleanup on Expo errors; optional delivery stats / receipts

---

*Document for Tandil Laravel API. Questions on mobile behaviour → contact Expo frontend developer.*
