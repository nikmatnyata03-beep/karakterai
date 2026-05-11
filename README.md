# NeuralChat — Server Follow-Up & Push Notification Setup

Panduan lengkap deploy NeuralChat ke Vercel dengan follow-up persisten (tetap berjalan saat browser ditutup) dan push notification.

---

## 🏗️ Arsitektur

```
Browser (index.html)
  │
  ├─ followUpEngine.schedule()
  │    ├─ [Browser open]  → setTimeout → generateFollowUp()  ← berjalan seperti biasa
  │    └─ [Semua kasus]   → POST /api/followups/schedule  → Supabase
  │
Vercel Cron Job (setiap menit)
  └─ GET /api/followups/process
       ├─ Query Supabase: followup_queue WHERE fired=false AND scheduled_at <= NOW()
       ├─ Jika browser sudah handle → skip (fired_by='browser')
       ├─ Generate pesan via OpenRouter API
       ├─ Simpan ke delivered_followups
       └─ Kirim Web Push Notification
  
Browser (buka lagi)
  └─ serverInit() → ncLoadServerFollowUps()
       ├─ GET /api/followups/delivered
       ├─ Inject pesan ke chat history
       └─ Toast "karakter mengirim pesan saat kamu pergi!"
```

---

## 📋 Prerequisites

- Node.js 18+
- Akun [Vercel](https://vercel.com) (plan **Pro** untuk cron 1 menit, Free = 60 menit)
- Akun [Supabase](https://supabase.com) (gratis)
- OpenRouter API Key

---

## 🚀 Setup Step-by-Step

### 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** → paste isi file `supabase-schema.sql` → klik **Run**
3. Catat:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (Settings > API > service_role) → `SUPABASE_SERVICE_KEY`
   
   > ⚠️ Gunakan `service_role` key, **bukan** `anon` key — karena akses dari server-side saja

### 2. Generate VAPID Keys (Push Notifications)

```bash
npm install
node scripts/generate-vapid.js
```

Catat output `VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY`.

### 3. Deploy ke Vercel

#### Option A: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

#### Option B: GitHub + Vercel Dashboard

1. Push repo ke GitHub
2. Import di [vercel.com/new](https://vercel.com/new)
3. Framework: **Other** (static + serverless)

### 4. Set Environment Variables di Vercel

Buka **Vercel Dashboard → Settings → Environment Variables**, tambahkan:

| Variable             | Value                          | Keterangan                              |
|---------------------|--------------------------------|-----------------------------------------|
| `SUPABASE_URL`      | `https://xxx.supabase.co`      | Project URL dari Supabase               |
| `SUPABASE_SERVICE_KEY` | `eyJ...`                    | service_role key dari Supabase          |
| `VAPID_PUBLIC_KEY`  | `BAxxx...`                     | Dari `generate-vapid.js`                |
| `VAPID_PRIVATE_KEY` | `xxx...`                       | Dari `generate-vapid.js` (RAHASIA!)     |
| `VAPID_EMAIL`       | `admin@yourdomain.com`         | Email untuk VAPID identity              |
| `CRON_SECRET`       | (auto-set oleh Vercel)         | Vercel set otomatis untuk cron auth     |

### 5. Tambahkan Icon untuk Push Notification (Opsional)

Tambahkan file berikut ke folder `public/`:
- `icon-192.png` — 192×192px app icon
- `icon-72.png` — 72×72px badge icon

Bisa gunakan tool online: [favicon.io](https://favicon.io)

---

## ⏱️ Catatan Cron Job

| Plan Vercel | Interval Minimum |
|-------------|-----------------|
| Free        | 60 menit        |
| Pro         | 1 menit         |

Jika pakai **Free plan**, ganti `vercel.json`:
```json
"schedule": "0 * * * *"
```
Artinya follow-up akan dicek setiap 1 jam. Delay follow-up tetap akurat karena dicek berdasarkan `scheduled_at`.

### Alternatif: Upstash QStash

Untuk interval lebih pendek tanpa upgrade Vercel, gunakan [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted):

1. Buat QStash schedule yang memanggil `https://your-app.vercel.app/api/followups/process` setiap menit
2. Set header `Authorization: Bearer YOUR_CRON_SECRET`

---

## 🔔 Flow Push Notification

1. User buka app pertama kali → browser minta izin notifikasi
2. Jika diizinkan → subscription disimpan ke Supabase `push_subscriptions`
3. Saat cron generate pesan → `web-push` kirim notifikasi ke browser
4. User klik notifikasi → app dibuka, langsung fokus ke karakter yang kirim pesan

### Test Push Notification

Buka DevTools → Application → Service Workers → klik **Push** untuk test.

---

## 🗄️ Database Tables

### `followup_queue`
Antrian follow-up yang dijadwalkan browser, diproses cron.

### `delivered_followups`  
Pesan yang sudah digenerate cron, menunggu browser ambil.

### `push_subscriptions`
Subscription Web Push per user device.

---

## 🔍 Troubleshooting

**Cron tidak jalan:**
- Pastikan `CRON_SECRET` ada di env vars Vercel
- Cek Vercel Dashboard → Functions → Cron Jobs

**Push notification tidak muncul:**
- Pastikan `VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY` di env vars
- Pastikan file `public/sw.js` bisa diakses di browser
- Cek browser: Application → Service Workers (harus "activated and running")
- VAPID keys harus di-generate ulang jika pernah deploy dengan keys berbeda

**Follow-up double-fire (browser + cron keduanya kirim):**
- Ini sudah ditangani: browser panggil `/api/followups/mark-fired` sebelum generate
- Cron pakai conditional update (`WHERE fired = false`) untuk atomic claim

**Supabase RLS error:**
- Pastikan pakai `service_role` key, bukan `anon` key
- RLS di-disable untuk semua table (akses dari server-side saja)

---

## 📁 File Structure

```
neuralchat/
├── vercel.json                    # Cron config + routing
├── package.json                   # Dependencies
├── supabase-schema.sql            # Run di Supabase SQL Editor
├── scripts/
│   └── generate-vapid.js          # Generate VAPID keys
├── api/
│   ├── followups/
│   │   ├── schedule.js            # Save follow-up to DB
│   │   ├── process.js             # Cron: generate + push
│   │   ├── delivered.js           # Fetch cron-generated messages
│   │   └── mark-fired.js          # Browser claims the follow-up
│   └── push/
│       ├── vapid-key.js           # Return public VAPID key
│       └── subscribe.js           # Save push subscription
└── public/
    ├── index.html                 # Modified NeuralChat app
    ├── sw.js                      # Service Worker
    ├── icon-192.png               # (tambahkan sendiri)
    └── icon-72.png                # (tambahkan sendiri)
```
