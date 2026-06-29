# GoMel Cars — Backend API + Admin Panel

Node.js + Express + PostgreSQL (via Prisma) backend for the GoMel Cars Flutter app.
Implements the exact REST contract the app expects (see the project's
`API_SETUP.md`) plus a web **admin panel**.

> You only need to **run** this — all the code is here. Install the tools below
> on your server Mac, set the `.env`, seed, and start.

---

## 1. Prerequisites (install on the server Mac)

| Tool | Why | Install |
|------|-----|---------|
| **Node.js 18+** | runs the server | https://nodejs.org (or `brew install node`) |
| **PostgreSQL 14+** | the database | `brew install postgresql@16` then `brew services start postgresql@16` and `createdb gomel_cars` — **or** a free [Neon](https://neon.tech) / [Supabase](https://supabase.com) cloud Postgres |

Check: `node -v` and `psql --version` (or have your Neon/Supabase connection string ready).

---

## 2. Setup

```bash
cd backend
npm install            # download dependencies (also runs `prisma generate`)
cp .env.example .env   # create your config
npx prisma migrate dev # create the tables in PostgreSQL
```

Open `.env` and set at least:
- `DATABASE_URL` — local Postgres works out of the box; for Neon/Supabase paste its URI
- `JWT_SECRET` — any long random string
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your admin login

---

## 3. Seed demo data (optional but recommended)

Loads the same 5 Ahmedabad cars, reviews, plans, and creates the admin account:

```bash
npm run seed
```

---

## 4. Run

```bash
npm run dev     # auto-reload while developing
# or
npm start       # plain start
```

You'll see:
```
API:         http://localhost:4000/api
Admin panel: http://localhost:4000/admin-panel
```

Open **http://localhost:4000/admin-panel** and log in with your
`ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 5. Connect the Flutter app

The API lives under **`/api`**, so point the app at that:

1. `lib/core/config/app_config.dart` → set `useRemoteApi = true`
2. Run the app with the base URL **including `/api`**:

```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_MAC_IP:4000/api
```

(Use your Mac's LAN IP, e.g. `192.168.1.20`, so a phone/emulator can reach it.
Android emulator can use `http://10.0.2.2:4000/api`.)

OTP login in dev: any phone works. The generated code is printed in the server
console and returned as `devOtp` in the response. `MASTER_OTP` in `.env`
(default `1234`) always works.

---

## 6. API endpoints

Base URL: `http://HOST:4000/api`

### Auth
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/otp/request` | `{ phone }` | `{ verificationId, devOtp? }` |
| POST | `/auth/otp/verify` | `{ phone, otp, verificationId }` | `{ token, user }` |
| GET | `/auth/me` | — (Bearer) | `{ user }` |
| PATCH | `/auth/me` | `{ name?, email?, avatarUrl?, upiId? }` | `{ user }` |

### Cars (public)
| GET | `/cars?city=&type=&q=` | `{ data: [Car] }` |
| GET | `/cars/:id` | `{ data: Car }` |
| GET | `/cars/:id/reviews` | `{ data: [Review] }` |

### Bookings (Bearer)
| GET | `/bookings` | `{ data: [Booking] }` |
| POST | `/bookings` | `{ data: Booking }` |
| PATCH | `/bookings/:id` | `{ data: Booking }` |

### Offers / promo codes
| GET | `/offers` | active codes (public) |
| POST | `/offers/validate` | `{ code, fareBase }` → computed discount (Bearer) |

### Referral (Bearer)
| GET | `/referral` | `{ code, reward, referredCount, totalEarned, referrals }` |
| POST | `/referral/apply` | `{ code }` — use a friend's code |

### Loyalty / rewards (Bearer)
| GET | `/loyalty` | `{ points, tier, nextThreshold, history }` |
| GET | `/loyalty/redeem-options` | catalogue |
| GET | `/loyalty/credits` | unused reward credits |
| POST | `/loyalty/redeem` | `{ optionId }` — spend points |

### Wallet (Bearer)
| GET | `/wallet` | `{ balance, transactions }` |
| POST | `/wallet/topup` | `{ amount, paymentId? }` |

### Host (Bearer)
| POST | `/host/become` | upgrade account to host |
| GET/POST | `/host/cars` | list / create own cars |
| PATCH/DELETE | `/host/cars/:id` | edit / remove own car |
| GET | `/host/stats` | earnings dashboard (HostStats shape) |
| GET/POST | `/host/payouts` | list / request a payout |

### Chat (Bearer) — polling-based (no websockets)
| GET | `/chats` | list conversations |
| GET | `/chats/support` | get/create the support conversation |
| POST | `/chats/host` | `{ hostId, hostName?, carId?, bookingId? }` |
| GET | `/chats/:id/messages?after=<iso>` | messages (`after` = poll only newer) |
| POST | `/chats/:id/messages` | `{ text }` → ChatMessage |

### Payments — Razorpay (Bearer, except webhook)
| POST | `/payments/razorpay/order` | `{ amount, purpose, refId? }` → `{ orderId, amount, currency, keyId, mock }` |
| POST | `/payments/razorpay/verify` | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` |
| POST | `/payments/razorpay/webhook` | called by Razorpay; verified by `X-Razorpay-Signature` |

> Without `RAZORPAY_KEY_ID`/`SECRET` in `.env` the API runs in **mock mode**:
> `order` returns a fake order id and `verify` accepts any signature, so the
> checkout flow is testable end-to-end. A `wallet`-purpose payment credits the
> wallet on success. Set the webhook URL in the Razorpay dashboard to
> `https://YOUR_API/api/payments/razorpay/webhook`.

### Misc
| GET | `/subscriptions` | plans (public) |
| GET | `/notifications` | Bearer |
| PATCH | `/notifications/:id/read` | Bearer |
| GET / POST | `/claims` | Bearer |
| POST | `/inspections` | Bearer |
| POST | `/kyc` | Bearer |
| POST | `/uploads` | Bearer, multipart field `file` → `{ url }` |

### Admin (Bearer with admin role)
`POST /admin/login`, `GET /admin/stats`, `GET/PATCH /admin/users(/:id)`,
`PATCH /admin/users/:id/kyc`, `GET/POST/PATCH/DELETE /admin/cars`,
`POST /admin/reviews`, `GET/PATCH /admin/bookings`, `GET/PATCH /admin/claims`,
`GET/POST/PATCH/DELETE /admin/offers`, `GET/PATCH /admin/payouts`,
`POST /admin/broadcast`.

> **Rewards flow:** completing a booking (`PATCH /bookings/:id` → `status:
> "completed"`) awards loyalty points (10% of base fare) and, if the renter
> signed up with a referral code, pays the referrer ₹500 to their wallet.

---

## 7. Project structure

```
backend/
├── src/
│   ├── server.js            # entry point
│   ├── app.js               # express app + middleware
│   ├── config/              # env + db connection
│   ├── db/                  # Prisma client (+ auto-id) and domain helpers
│   ├── middleware/          # auth, admin, error, file upload
│   ├── controllers/         # request handlers
│   ├── routes/              # endpoint wiring
│   └── seed/seed.js         # demo data + admin account
├── prisma/
│   ├── schema.prisma        # PostgreSQL schema (match the Dart models)
│   └── migrations/          # generated SQL migrations
├── public/admin/            # admin panel (static HTML/CSS/JS)
├── uploads/                 # uploaded images land here
└── .env.example
```

---

## 8. Going to production

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, blank `MASTER_OTP`, and
  plug a real SMS provider into `src/controllers/authController.js` (`requestOtp`).
- Put a real SMS + (optionally) Razorpay webhook handler in place.
- Use a process manager (`pm2 start src/server.js`) or your host's Node app
  manager, and serve behind HTTPS.

> ⚠️ Note on shared cPanel hosting: Node apps need the host's **"Setup Node.js
> App"** feature (Passenger). If your plan doesn't have it, run this on a small
> VPS or a free Node host (Render/Railway) and point `DATABASE_URL` at a managed
> Postgres (Neon/Supabase). Real-time chat would use polling rather than
> websockets on shared hosting.
