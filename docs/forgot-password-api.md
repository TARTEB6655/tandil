# Forgot password API (all portals)

Steps 1–2: only **`roles`** changes (must match `POST /auth/login`).  
Step 3: **same** `POST /auth/reset-password` for every portal — no `roles` in body; use **`reset_token`** from verify-otp.

---

## 1. Send SMS OTP

**POST** `/auth/forgot-password`

```json
{
  "phone": "+971501234567",
  "roles": "client"
}
```

| Portal | `roles` |
|--------|---------|
| Client | `client` |
| Admin | `admin` |
| HR Manager | `hr` |
| Area Manager | `area_manager` |
| Supervisor | `supervisor` |
| Technician | `technician` |
| Vendor | `vendor` |
| Delivery | `delivery` |

---

## 2. Verify OTP

**POST** `/auth/verify-otp`

```json
{
  "phone": "+971501234567",
  "roles": "client",
  "otp": "123456"
}
```

**Response:** save `data.reset_token` for step 3.

---

## 3. Reset password (all roles — same endpoint)

**POST** `/auth/reset-password`

```json
{
  "reset_token": "<from verify-otp>",
  "password": "newpassword123",
  "password_confirmation": "newpassword123"
}
```

No `roles` field on this request. The token is tied to the portal from steps 1–2.

Mobile flow:

1. `forgotPasswordService.requestOtp({ phone, role })`
2. `forgotPasswordService.verifyOtp({ phone, role, otp })` → `reset_token`
3. `forgotPasswordService.resetPassword({ reset_token, password, password_confirmation })`

Implementation: `src/services/forgotPasswordService.ts`
