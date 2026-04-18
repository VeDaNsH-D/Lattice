/**
 * POSTMAN TESTING GUIDE: EMAIL INVITATION SYSTEM
 * =============================================
 * 
 * Follow these steps to test email sending in Postman
 */

// ============================================
// STEP 1: SET UP POSTMAN ENVIRONMENT
// ============================================
/**
 * Create a new Postman Environment with these variables:
 * 
 * BASE_URL: http://localhost:8000
 * JWT_TOKEN: (you'll get this after login)
 * PROJECT_ID: (you'll get this after creating a project)
 * ROLE_ID: (you'll get this after creating a role)
 * INVITE_ID: (you'll get this after creating an invite)
 */

// ============================================
// STEP 2: AUTHENTICATE (Login or Register)
// ============================================
/*
GET /api/auth/google
OR
POST /api/auth/register (if available)

Response will contain JWT token
Copy token and save as {{JWT_TOKEN}} in Postman Environment
*/

// ============================================
// STEP 3: CREATE A PROJECT
// ============================================
/*
REQUEST:
POST {{BASE_URL}}/api/projects
Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{JWT_TOKEN}}

BODY (raw JSON):
{
  "name": "Test Project for Email"
}

RESPONSE:
{
  "success": true,
  "project": {
    "_id": "PROJECT_ID_HERE",
    "name": "Test Project for Email",
    "createdBy": "USER_ID_HERE",
    "createdAt": "2026-04-18T10:30:00Z"
  }
}

✓ Save project._id as {{PROJECT_ID}} in Environment
*/

// ============================================
// STEP 4: CREATE A ROLE
// ============================================
/*
REQUEST:
POST {{BASE_URL}}/api/roles

Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{JWT_TOKEN}}

BODY (raw JSON):
{
  "name": "Editor",
  "projectId": "{{PROJECT_ID}}",
  "permissions": "restricted_access"
}

RESPONSE:
{
  "success": true,
  "role": {
    "_id": "ROLE_ID_HERE",
    "name": "Editor",
    "projectId": "{{PROJECT_ID}}",
    "permissions": "restricted_access",
    "createdBy": "USER_ID_HERE",
    "createdAt": "2026-04-18T10:30:00Z"
  }
}

✓ Save role._id as {{ROLE_ID}} in Environment
*/

// ============================================
// STEP 5: SEND INVITE EMAIL (MAIN TEST)
// ============================================
/*
REQUEST:
POST {{BASE_URL}}/api/invites

Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{JWT_TOKEN}}

BODY (raw JSON):
{
  "email": "test.user@gmail.com",
  "projectId": "{{PROJECT_ID}}",
  "roleId": "{{ROLE_ID}}"
}

RESPONSE (201 Created):
{
  "success": true,
  "invite": {
    "_id": "INVITE_ID_HERE",
    "email": "test.user@gmail.com",
    "projectId": {
      "_id": "{{PROJECT_ID}}",
      "name": "Test Project for Email"
    },
    "roleId": {
      "_id": "{{ROLE_ID}}",
      "name": "Editor",
      "permissions": "restricted_access"
    },
    "invitedBy": {
      "_id": "USER_ID_HERE",
      "email": "your-email@gmail.com",
      "name": "Your Name"
    },
    "status": "pending",
    "createdAt": "2026-04-18T10:35:00Z"
  }
}

✓ Save invite._id as {{INVITE_ID}} in Environment
✓ Check your email for the invitation!
*/

// ============================================
// STEP 6: CHECK EMAIL DELIVERY
// ============================================
/*
After sending the invite via Postman:

1. Check the email inbox of test.user@gmail.com
2. Look for email with subject: "[Name] invited you to join a project on ShelfLife"
3. Verify the email contains:
   - Your project name
   - The role name (Editor)
   - Blue "View Invitation" button
   - Fallback link to http://localhost:3000/invites/{inviteId}/accept
*/

// ============================================
// STEP 7: VERIFY IN BACKEND LOGS
// ============================================
/*
Check your backend terminal (npm run dev):

Look for log messages like:
✓ Invite email sent to test.user@gmail.com

If email failed, you'll see:
✗ Error sending invite email: [error message]

Common issues:
- Email credentials not in .env file
- SMTP credentials incorrect
- Email service not configured
- Network connection issues
*/

// ============================================
// STEP 8: TEST OTHER INVITE ENDPOINTS
// ============================================

// (A) GET PENDING INVITES
/*
REQUEST:
GET {{BASE_URL}}/api/invites/project/{{PROJECT_ID}}

Headers:
  - Authorization: Bearer {{JWT_TOKEN}}

Expected: List of all pending invites for this project
*/

// (B) ACCEPT INVITE
/*
REQUEST:
POST {{BASE_URL}}/api/invites/{{INVITE_ID}}/accept

Headers:
  - Authorization: Bearer {{JWT_TOKEN}}
  (Must be logged in as the invited user's email!)

Expected: 200 OK + user added to ProjectMember
*/

// (C) DECLINE/REVOKE INVITE
/*
REQUEST:
DELETE {{BASE_URL}}/api/invites/{{INVITE_ID}}

Headers:
  - Authorization: Bearer {{JWT_TOKEN}}

Expected: 200 OK + invite deleted
*/

// ============================================
// TESTING WITHOUT REAL EMAIL SERVICE
// ============================================
/*
If you don't have EMAIL_SERVICE configured yet:

1. OPTION A: Use Ethereal Email (FREE, for testing)
   - Visit: https://ethereal.email/create
   - Get test credentials
   - Add to .env:
     EMAIL_SERVICE=gmail
     EMAIL_USER=your-ethereal-email@ethereal.email
     EMAIL_PASSWORD=your-ethereal-password

2. OPTION B: Use Gmail App Password
   - Enable 2FA on Gmail account
   - Go to: https://myaccount.google.com/apppasswords
   - Generate new App Password (16 chars)
   - Add to .env:
     EMAIL_SERVICE=gmail
     EMAIL_USER=your-gmail@gmail.com
     EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

3. OPTION C: Mock Email Service (Development)
   - In email.service.js, replace transporter with:
     const transporter = {
       sendMail: async (mailOptions) => {
         console.log("📧 EMAIL WOULD BE SENT:");
         console.log("TO:", mailOptions.to);
         console.log("SUBJECT:", mailOptions.subject);
         return { messageId: "mock-id-123" };
       }
     };
*/

// ============================================
// POSTMAN COLLECTION TEMPLATE
// ============================================
/*
Export this as JSON to import into Postman:
{
  "info": {
    "name": "ShelfLife Invite System Email Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Create Project",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{JWT_TOKEN}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"name\": \"Test Project\"}"
        },
        "url": {
          "raw": "{{BASE_URL}}/api/projects",
          "host": ["{{BASE_URL}}"],
          "path": ["api", "projects"]
        }
      }
    },
    {
      "name": "2. Create Role",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{JWT_TOKEN}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"name\": \"Editor\", \"projectId\": \"{{PROJECT_ID}}\", \"permissions\": \"restricted_access\"}"
        },
        "url": {
          "raw": "{{BASE_URL}}/api/roles",
          "host": ["{{BASE_URL}}"],
          "path": ["api", "roles"]
        }
      }
    },
    {
      "name": "3. Send Invite Email",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{JWT_TOKEN}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"email\": \"test.user@gmail.com\", \"projectId\": \"{{PROJECT_ID}}\", \"roleId\": \"{{ROLE_ID}}\"}"
        },
        "url": {
          "raw": "{{BASE_URL}}/api/invites",
          "host": ["{{BASE_URL}}"],
          "path": ["api", "invites"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "BASE_URL",
      "value": "http://localhost:8000"
    },
    {
      "key": "JWT_TOKEN",
      "value": ""
    },
    {
      "key": "PROJECT_ID",
      "value": ""
    },
    {
      "key": "ROLE_ID",
      "value": ""
    },
    {
      "key": "INVITE_ID",
      "value": ""
    }
  ]
}
*/
