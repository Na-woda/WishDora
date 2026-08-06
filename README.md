# WishDora — Full-Stack Setup Guide

## Project Structure
```
wishdora/
├── backend/                 ← Node.js + Express API
│   ├── server.js            ← Main server entry point
│   ├── 
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


## Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```


