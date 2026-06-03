# App Store Review Notes (copy into App Store Connect → App Review Information → Notes)

**Demo account (if required):**  
Provide a test client email/password that can complete checkout, or state that reviewers can browse as guest without an account and register only at checkout.

---

## What Tandil is

Tandil is a **marketplace and service platform** operating in the United Arab Emirates. The app connects customers with:

- **Physical products** — fresh fruits, vegetables, poultry, seafood, honey, and related grocery items sold through our online shop.
- **Real-world services** — landscaping, garden care, planting, and other agriculture-related field services booked for on-site visits.

Tandil is **not** a digital-content store. Users do **not** pay to unlock digital features, subscriptions to digital media, or in-app currency for virtual goods.

---

## Guest browsing (Guideline 5.1.1)

Reviewers can use the app **without registering**:

1. Open the app → choose **Client (Customer)** on the role screen.
2. The app opens the **Home**, **Services**, and **Store** tabs immediately (no login wall).
3. Browse categories, service listings, and product details freely.
4. **Sign in or register** is only requested when:
   - Adding items to the **cart**
   - **Checkout** / placing a shop order
   - **Buy Now**
   - **Orders**, **Wallet**, **Profile** account features

To test login: Profile tab → **Log in** / **Sign up**.

---

## Account deletion (Guideline 5.1.1(v))

Users can permanently delete their account in the app:

1. Client → **Profile** tab → log in if needed.
2. Tap **Delete Account** (above Logout).
3. Enter your **password**, type **DELETE** to confirm, then tap **Delete**.
4. Confirm again in the dialog — account is removed on the server and the app signs out.

Demo account for review: use a test account you create in-app, or provide credentials in App Review Information. Deletion is irreversible for that account.

---

## Payments

- Shop checkout uses **Stripe** for card payments (Payment Sheet).
- Payments are for **physical goods delivery** and **real-world service bookings** only.
- **Apple Pay** is **not** enabled in this build (card entry via Stripe Payment Sheet only).
- Users do **not** pay to create an account. Registration is free.

---

## Business model summary

| Item | Description |
|------|-------------|
| Revenue | Product sales + service booking fees |
| Goods | Physical groceries / fresh products (delivered) |
| Services | On-site landscaping / agriculture work |
| Accounts | Free; required only for cart, checkout, orders |
| Digital unlocks | None |
| Paid account creation | None |

---

## Suggested reviewer path

1. Client → browse Store → open a product (no login).
2. Try **Add to cart** → prompted to log in (expected).
3. Log in with demo account → add to cart → checkout → pay with test card (Stripe test mode if applicable).
4. Services tab → browse service categories and products (no login).
5. Optional: Technician / Admin roles are **staff-only** and require separate credentials (not required for customer review).

---

*Update demo credentials and Stripe test/live mode before each submission.*
