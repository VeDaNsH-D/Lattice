import nodemailer from "nodemailer";

// Initialize transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Test connection (optional, for debugging)
export const testEmailConnection = async () => {
    try {
        await transporter.verify();
        console.log("✓ Email service connected successfully");
    } catch (error) {
        console.error("✗ Email service connection failed:", error.message);
    }
};

export const sendInviteEmail = async (emailData) => {
    try {
        const { email, inviterName, projectName, roleName, inviteId } = emailData;

        if (!email || !inviterName || !projectName || !roleName || !inviteId) {
            throw new Error("Missing required email data");
        }

        const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
        const inviteLink = `${frontendBaseUrl}/invite/${inviteId}`;
        const appName = "Lattice";

        const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited to Collaborate</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;">
    <div style="background-color: #f4f6ef; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #6b8e23 0%, #5f7f1f 100%); padding: 30px 20px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">${appName}</h1>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">
                
                <!-- Greeting -->
                <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 28px; font-weight: 700; text-align: center;">You're invited to collaborate 🚀</h2>
                
                <div style="height: 24px;"></div>

                <!-- Invitation Text -->
                <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
                    <strong style="color: #1f2937;">${inviterName}</strong> has invited you to join the project
                </p>

                <!-- Project Info Card -->
                <div style="background-color: #f9faf5; border-left: 4px solid #6b8e23; padding: 20px; border-radius: 4px; margin: 30px 0;">
                    <div style="margin-bottom: 12px;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Project</p>
                        <p style="margin: 4px 0 0 0; color: #1f2937; font-size: 18px; font-weight: 700;">${projectName}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Role</p>
                        <p style="margin: 4px 0 0 0; color: #5f7f1f; font-size: 16px; font-weight: 600;">${roleName}</p>
                    </div>
                </div>

                <div style="height: 20px;"></div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="display: inline-block; background-color: #6b8e23; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s ease; border: none; cursor: pointer;" onmouseover="this.style.backgroundColor='#5f7f1f'" onmouseout="this.style.backgroundColor='#6b8e23'">
                        View Invitation
                    </a>
                </div>

                <div style="height: 20px;"></div>

                <!-- Fallback Link -->
                <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center; word-break: break-all;">
                    If button doesn't work, copy this link:<br>
                    <a href="${inviteLink}" style="color: #5f7f1f; text-decoration: none;">${inviteLink}</a>
                </p>

            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                    If you did not expect this invitation, you can safely ignore this email.
                </p>
                <div style="height: 16px;"></div>
                <p style="margin: 0; color: #d1d5db; font-size: 12px; text-align: center;">
                    © 2026 ${appName}. All rights reserved.
                </p>
            </div>

        </div>

        <!-- Unsubscribe/Support Info -->
        <div style="text-align: center; margin-top: 20px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Have questions? <a href="mailto:support@lattice.dev" style="color: #5f7f1f; text-decoration: none;">Contact support</a>
            </p>
        </div>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER || "noreply@lattice.dev",
            to: email,
            subject: `${inviterName} invited you to join a project on ${appName}`,
            html: htmlTemplate,
            text: `
${appName}

You're invited to collaborate 🚀

${inviterName} has invited you to join the project

Project: ${projectName}
Your Role: ${roleName}

View your invitation: ${inviteLink}

If you did not expect this invitation, you can safely ignore this email.
            `
        };

        const result = await transporter.sendMail(mailOptions);

        console.log(`✓ Invite email sent to ${email}`);
        return {
            success: true,
            messageId: result.messageId
        };
    } catch (error) {
        console.error("✗ Error sending invite email:", error.message);
        throw error;
    }
};

export const sendWelcomeEmail = async (email, userName) => {
    try {
        const appName = "Lattice";

        const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${appName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;">
    <div style="background-color: #f5f5f5; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">${appName}</h1>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px; text-align: center;">
                <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 28px; font-weight: 700;">Welcome, ${userName}! 👋</h2>
                <p style="margin: 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    We're thrilled to have you on board.
                </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                    © 2026 ${appName}. All rights reserved.
                </p>
            </div>

        </div>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER || "noreply@lattice.dev",
            to: email,
            subject: `Welcome to ${appName}`,
            html: htmlTemplate
        };

        await transporter.sendMail(mailOptions);
        console.log(`✓ Welcome email sent to ${email}`);

        return { success: true };
    } catch (error) {
        console.error("✗ Error sending welcome email:", error.message);
        throw error;
    }
};

export default transporter;
