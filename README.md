# WishDora — Full-Stack Setup Guide

# WishDora 

WishDora is a full-stack web application that allows users to create, schedule, and send personalized wishes for special occasions. Users can prepare wishes in advance, attach greeting cards, and automatically deliver them on the selected date and time.

##  Features

* User Registration and Authentication (JWT)
* Secure Login and Account Management
* Create and Schedule Wishes
* Upload and Manage Greeting Cards
* Automated Wish Delivery
* Email Notification Integration
* Responsive User Interface
* Admin Dashboard for Management
* MongoDB Database Integration
* RESTful API Architecture

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript (ES6)

### Backend

* Node.js
* Express.js

### Database

* MongoDB
* Mongoose

### Security & Utilities

* JWT Authentication
* Helmet
* CORS
* Express Rate Limiting
* Cloudinary (Image Storage)

## 📂 Project Structure

```
WishDora/
│
├── frontend/
│   ├── pages/
│   ├── css/
│   ├── js/
│   └── assets/
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── config/
│   └── server.js
│
└── README.md
```

## 🚀 Installation

### Clone Repository

```bash
git clone <repository-url>
cd WishDora
```

### Backend Setup

```bash
cd backend
npm install
```



Start the backend:

```bash
npm start
```

### Frontend Setup

Open the frontend project and run it using a local server such as VS Code Live Server.

## 📅 How It Works

1. User registers and logs in.
2. User creates a wish.
3. User selects a delivery date and time.
4. User chooses or uploads a greeting card.
5. WishDora stores the scheduled wish.
6. When the scheduled time arrives, the system automatically sends the wish via email.

##  Security Features

* Password Hashing
* JWT Authentication
* Rate Limiting
* Helmet Security Headers
* Protected API Routes
* Input Validation

##  Future Enhancements

* WhatsApp Message Delivery
* SMS Integration
* Recurring Wishes
* Mobile Application
* Social Media Sharing
* AI-Generated Wish Suggestions

##  Author

Developed by **M. Nawoda Lakshani Perera**

Software Engineering Undergraduate
The Open University Of Sri Lanka

## 📄 License

Copyright © 2026 WishDora.

All rights reserved.

WishDora is a proprietary application currently under active development. Unauthorized copying, distribution, or commercial use of this software is prohibited without permission from the owner.

