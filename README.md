# WishDora — Full-Stack Setup Guide

## Project Structure
```
wishdora/
├── backend/                 ← Node.js + Express API
│   ├── server.js            ← Main server entry point
│   ├── .env.example         ← Copy to .env and fill in values
│   ├── models/
│   │   ├── User.js          ← MongoDB User model
│   │   └── Wish.js          ← MongoDB Wish model (with scheduling fields)
│   ├── routes/
│   │   ├── auth.js          ← Register / Login / Profile
│   │   └── wishes.js        ← CRUD + resend endpoint
│   ├── services/
│   │   ├── emailService.js  ← Nodemailer + Gmail SMTP
│   │   ├── whatsappService.js ← Meta WhatsApp Cloud API
│   │   └── schedulerService.js ← Stateless external scheduler processing
│   └── middleware/
│       └── auth.js          ← JWT verification
│
└── frontend/public/         ← Static HTML/CSS/JS pages
    ├── index.html           ← Home page
    ├── signin.html          ← Sign In
    ├── register.html        ← Create Account (3-step)
    ├── wishform.html        ← Schedule a Wish
    ├── dashboard.html       ← User Dashboard
    ├── css/
    │   ├── mainStyle.css
    │   └── userdashboard.css
    └── js/
        └── api.js           ← Shared API client (Auth, WishesAPI, DarkMode, showToast)
```

---

## Step 1: Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **MongoDB** — Install locally OR use MongoDB Atlas (free)
  - Local: `mongod --dbpath /data/db`
  - Atlas: https://www.mongodb.com/cloud/atlas/register
- **Gmail Account** with App Password enabled

---

## Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/wishdora   # or Atlas URI
JWT_SECRET=change_this_to_a_long_random_string_at_least_32_chars

GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx          # 16-char Google App Password

WHATSAPP_PHONE_NUMBER_ID=1234567890123          # From Meta Developer Portal
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx        # Meta permanent token
WHATSAPP_FROM_NUMBER=+94XXXXXXXXX               # Your WhatsApp Business number

FRONTEND_URL=http://localhost:3000
```

### How to get Gmail App Password
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to **App Passwords** → Select app: "Mail" → Device: "Other (WishDora)"
4. Copy the 16-character password into `GMAIL_APP_PASSWORD`

### How to get WhatsApp Business API credentials
1. Go to https://developers.facebook.com
2. Create an App → Add **WhatsApp** product
3. Go to WhatsApp → Getting Started
4. Copy **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
5. Generate **Permanent Token** → `WHATSAPP_ACCESS_TOKEN`
6. Add your business number → `WHATSAPP_FROM_NUMBER`

---

## Step 3: Install & Start Backend

```bash
cd backend
npm install
npm start
```

You should see:
```
✅ MongoDB connected: localhost
✅ Gmail SMTP ready
⏰ Wish scheduler started — checking every minute
🚀 WishDora API running on http://localhost:5000
```

Test the API:
```
http://localhost:5000/api/health
```

---

## Step 4: Serve Frontend

Since it's plain HTML/CSS/JS, serve with any static server:

```bash
# Option A: Node http-server (install once)
npm install -g http-server
cd frontend/public
http-server -p 3000

# Option B: VS Code Live Server extension
# Open frontend/public/index.html → Right-click → Open with Live Server

# Option C: Python
cd frontend/public
python3 -m http.server 3000
```

Open: **http://localhost:3000**

---

## Step 5: How Scheduling Works

cron-job.org calls `GET /api/scheduler/run` every minute with the configured
`Authorization: Bearer <CRON_SECRET>` header:

```
Each request → Query MongoDB for wishes where:
  status = 'Pending' AND scheduleDate ≤ now

For each due wish:
  → Atomically change its status to 'Processing' before delivery
  → Send via Email (Gmail SMTP) if deliveryMethod = 'email' or 'both'
  → Update status to 'Sent' or 'Failed'
  → If repeat = 'yearly': create new wish for next year
  → If repeat = 'daily': create new wish for tomorrow
```

**This means:** The scheduler has no in-memory state. A request after a server
restart or free-hosting wake-up catches up on overdue pending wishes without
duplicate claims.

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in → returns JWT token |
| GET | `/api/auth/me` | Get logged-in user (requires token) |
| PUT | `/api/auth/profile` | Update name/phone |

### Wishes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishes` | Get all wishes for user |
| GET | `/api/wishes/upcoming` | Next 30 days |
| POST | `/api/wishes` | Create & schedule |
| PUT | `/api/wishes/:id` | Edit a wish |
| DELETE | `/api/wishes/:id` | Delete |
| POST | `/api/wishes/:id/resend` | Manually resend |

**All wish endpoints require** `Authorization: Bearer <token>` header.

---

## Production Deployment

### Backend (Railway / Render / DigitalOcean)
```bash
# Set NODE_ENV=production
# Set MONGODB_URI to Atlas connection string
# Set FRONTEND_URL to your domain

npm start
```

### Frontend (Netlify / Vercel / GitHub Pages)
1. Update `API_BASE` in `frontend/public/js/api.js`:
   ```js
   const API_BASE = 'https://your-backend-domain.com/api';
   ```
2. Deploy `frontend/public/` folder

### Keep server alive (PM2)
```bash
npm install -g pm2
pm2 start backend/server.js --name wishdora
pm2 save
pm2 startup
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Email not sending | Check GMAIL_APP_PASSWORD, ensure 2FA is on |
| WhatsApp not sending | Check WHATSAPP_PHONE_NUMBER_ID and token |
| MongoDB connection failed | Check MONGODB_URI, ensure mongod is running |
| CORS error | Update FRONTEND_URL in .env |
| Wishes not auto-sending | Check server is running (cron needs process to be alive) |
| JWT expired | Login again to get a fresh token |






## future idea 
how to make I want to create upload images as greeting cards and user can select what they want . is i think first of all i want to create admin dash board and update my site and future i want to add primium mood also sugest me what is best and also i want to use send wish via whatsapp to than email and say how can i publish this can i only use STMP is that worth explain




Yes, your idea is good. Best order:
Admin Dashboard First
Build admin dashboard where only admin can:upload greeting card images
add category: Birthday, Anniversary, Wedding, Congratulations
mark cards as free or premium
delete/update cards
see users and scheduled wishes

Greeting Card Upload
Do not store uploaded images directly in MongoDB. Better:Store image files in Cloudinary, Firebase Storage, S3, or local /uploads for development
Store only image URL in database

Example card model:
{
  title: "Birthday Gold Card",
  category: "birthday",
  imageUrl: "https://...",
  isPremium: false,
  createdBy: adminId
}

Then user side:
fetch cards from backend
show cards in wishform.html
user selects one
selected card ID is saved with the wish
Premium Mode
Good idea, but add it later. First finish free system.

Best premium features:
premium greeting card designs
WhatsApp sending
yearly auto-repeat
remove WishDora branding
more scheduled wishes
custom upload card by user

You can use Stripe later for international payments. If your users are mainly Sri Lanka, also check local payment gateways.

Email Sending: SMTP or Email API?
SMTP works, and it is worth it for your first version.

For Node.js, Nodemailer supports SMTP and says almost every email provider supports SMTP. It also supports pooled SMTP connections for sending many emails faster. Source: Nodemailer SMTP docs: https://nodemailer.com/smtp

But for production, I prefer an email API like:
Resend
SendGrid
Mailgun
Amazon SES

Why API is better than plain Gmail SMTP:
better delivery logs
fewer blocked emails
domain verification
easier scaling
better templates
Resend requires an API key and verified domain for proper sending. Source: https://resend.com/docs/send-with-nodejs

My recommendation:
Development: Gmail SMTP or Mailtrap
Production: Resend, SendGrid, Mailgun, or Amazon SES

WhatsApp Sending
You cannot reliably send automatic WhatsApp messages using normal WhatsApp Web hacks. Avoid unofficial methods because accounts can get blocked.

Use:
Meta WhatsApp Business Cloud API
or Twilio WhatsApp API
or providers like WATI, Gupshup, MessageBird

Important limitation:
For scheduled automatic wishes, WhatsApp usually needs approved message templates, especially when your app starts the message. Twilio’s WhatsApp docs are here: https://www.twilio.com/docs/whatsapp

So best flow:
Email sending for free users
WhatsApp sending for premium users
Ask user to verify/opt-in their WhatsApp number
Use approved template like:
“Hi {{name}}, you received a wish from {{sender}}: {{message}}”


Publishing
You need:frontend hosting: Netlify, Vercel, or Render static site
backend hosting: Render, Railway, Fly.io, or VPS
database: MongoDB Atlas
image storage: Cloudinary
email provider: Resend/SendGrid/Amazon SES
domain name
environment variables for secrets

Best simple stack:

Frontend: Vercel or Netlify
Backend: Render
Database: MongoDB Atlas
Images: Cloudinary
Email: Resend
WhatsApp later: Twilio or Meta Cloud API

Build order I suggest:

Admin login/role
Admin greeting card upload
User card selection in wishform.html
Save selected card with wish
Email sending
Scheduled job/cron
Publish
Premium mode
WhatsApp sending

Do not start with premium or WhatsApp first. Get image cards + email scheduling working first. That gives you the real product core.
