const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function sendTestEmail() {
    console.log('\nStarting Email Test...\n');
    
    const targetEmail = 'ownerrage2@gmail.com';
    
    console.log('Configuration:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        from: process.env.SMTP_USER,
        to: targetEmail
    });

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        debug: true,
        logger: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    });

    try {
        console.log('\nVerifying SMTP connection...');
        await transporter.verify();
        console.log('✓ SMTP Connection verified successfully');

        console.log('\nSending test email...');
        const info = await transporter.sendMail({
            from: `"RifasCAI Test" <${process.env.SMTP_USER}>`,
            to: targetEmail,
            subject: 'RifasCAI Email System Test',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <h2 style="color: #6a1b9a;">RifasCAI Email System Test</h2>
                    <p>This is a test email to verify the email system for RifasCAI is working correctly.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Configuration Details:</h3>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>✉️ From: ${process.env.SMTP_USER}</li>
                            <li>📨 To: ${targetEmail}</li>
                            <li>🕒 Time Sent: ${new Date().toLocaleString()}</li>
                        </ul>
                    </div>
                    <p>If you received this email, it means the email system is configured correctly!</p>
                    <p style="color: #666; font-size: 0.9em; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                        This is an automated test email from RifasCAI System.
                    </p>
                </div>
            `
        });

        console.log('✓ Test email sent successfully!');
        console.log('Message details:', {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected
        });
        
        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };

    } catch (error) {
        console.error('✖ Error:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        throw error;
    }
}

// Run the test
sendTestEmail()
    .then(result => {
        console.log('\n✓ Email test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✖ Email test failed:', error.message);
        process.exit(1);
    });