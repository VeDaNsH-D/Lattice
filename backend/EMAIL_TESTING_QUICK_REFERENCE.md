# 📧 Email Testing Quick Reference

## ⚡ QUICK START

### 1. Import Postman Collection
```
File → Import → ShelfLife_Email_Testing.postman_collection.json
```

### 2. Set Up Environment Variables
Click environment icon → Create/Edit environment with:
```
BASE_URL = http://localhost:8000
JWT_TOKEN = (get from login response)
PROJECT_ID = (get from create project response)
ROLE_ID = (get from create role response)
INVITE_ID = (get from send invite response)
```

### 3. Make Requests in Order
1. **Create Project** → Copy `response.project._id` → Set as `{{PROJECT_ID}}`
2. **Create Role** → Copy `response.role._id` → Set as `{{ROLE_ID}}`
3. **Send Invite** → Copy `response.invite._id` → Set as `{{INVITE_ID}}`
4. **Check Email** → Look for invitation in email inbox
5. **Verify** → List projects invites or Accept invite

---

## 📋 REQUEST EXAMPLES

### CREATE PROJECT
```
POST http://localhost:8000/api/projects
Authorization: Bearer {{JWT_TOKEN}}
Content-Type: application/json

{
  "name": "Test Project"
}
```

### CREATE ROLE
```
POST http://localhost:8000/api/roles
Authorization: Bearer {{JWT_TOKEN}}
Content-Type: application/json

{
  "name": "Editor",
  "projectId": "{{PROJECT_ID}}",
  "permissions": "restricted_access"
}
```

### SEND INVITE (EMAIL TEST) ✉️
```
POST http://localhost:8000/api/invites
Authorization: Bearer {{JWT_TOKEN}}
Content-Type: application/json

{
  "email": "test@example.com",
  "projectId": "{{PROJECT_ID}}",
  "roleId": "{{ROLE_ID}}"
}
```

### LIST PENDING INVITES
```
GET http://localhost:8000/api/invites/project/{{PROJECT_ID}}
Authorization: Bearer {{JWT_TOKEN}}
```

### ACCEPT INVITE
```
POST http://localhost:8000/api/invites/{{INVITE_ID}}/accept
Authorization: Bearer {{JWT_TOKEN}}
```

### DECLINE INVITE
```
DELETE http://localhost:8000/api/invites/{{INVITE_ID}}
Authorization: Bearer {{JWT_TOKEN}}
```

---

## ✅ EXPECTED RESPONSES

### Send Invite Success (201)
```json
{
  "success": true,
  "invite": {
    "_id": "invite123",
    "email": "test@example.com",
    "projectId": { "_id": "...", "name": "..." },
    "roleId": { "_id": "...", "name": "...", "permissions": "..." },
    "invitedBy": { "_id": "...", "email": "...", "name": "..." },
    "status": "pending",
    "createdAt": "2026-04-18T..."
  }
}
```

### Email NOT Sent? Check:
- ✗ Backend logs for errors
- ✗ `.env` has EMAIL_USER and EMAIL_PASSWORD
- ✗ Gmail requires App Password (not regular password)
- ✗ ESP credentials are correct
- ✗ Network connectivity

---

## 🔧 SETUP: Email Service Configuration

### Option 1: Gmail (Recommended)
```
1. Go to https://myaccount.google.com/apppasswords
2. Generate new App Password (16 chars)
3. Add to .env:

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### Option 2: Ethereal (Free Test Email)
```
1. Create account: https://ethereal.email/create
2. Add to .env:

EMAIL_SERVICE=gmail
EMAIL_USER=your-ethereal@ethereal.email
EMAIL_PASSWORD=your-password
```

### Option 3: Mock Email (Development)
Edit `backend/services/email.service.js`:
```javascript
const transporter = {
  sendMail: async (mailOptions) => {
    console.log("📧 WOULD SEND EMAIL TO:", mailOptions.to);
    return { messageId: "mock-123" };
  }
};
```

---

## 📊 BACKEND LOGS TO CHECK

Start backend: `npm run dev`

### Email Sent Successfully
```
✓ Invite email sent to test@example.com
```

### Email Failed
```
✗ Error sending invite email: [error_message]
```

### Check entire invite creation:
- `inviteUser` function should log email sending
- Check all database operations succeeded
- Verify JWT authentication worked

---

## 🧪 TESTING CHECKLIST

- [ ] Backend running: `npm run dev`
- [ ] MongoDB connected
- [ ] `.env` has EMAIL credentials
- [ ] Postman collection imported
- [ ] Environment variables set (BASE_URL, JWT_TOKEN, etc.)
- [ ] Can create project
- [ ] Can create role
- [ ] Can send invite
- [ ] Email received in inbox
- [ ] Email template displays correctly
- [ ] CTA button works
- [ ] Can accept/decline invite

---

## 🐛 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| 400 Missing email | Check JSON body includes `email` field |
| 403 Forbidden | Verify you're project owner |
| 404 Role not found | Check role belongs to same project |
| Email not sent | Check .env EMAIL credentials |
| Email sent but not received | Check spam folder, wait 2-5 mins |
| ENOTFOUND error | Check EMAIL_SERVICE value in .env |
| EAUTH error | Check EMAIL_USER/PASSWORD are correct |

---

## 📝 NOTES

- Emails send asynchronously (don't block response)
- Each project can have multiple pending invites
- Only project owners can send invites
- Only invited user can accept their invitation
- Email subject: `"{Name} invited you to join a project on ShelfLife"`
