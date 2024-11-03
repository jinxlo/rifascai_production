const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Define absolute path to .env
const envPath = 'C:\\Users\\Administrator\\Desktop\\RifasCAIv2-1\\backend\\.env';

async function sendTestEmailWithHeaders() {
    console.log('\nStarting Enhanced Email Test...\n');
    
    const targetEmail = 'ownerrage2@gmail.com';
    
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
        socketTimeout: 10000,
        tls: {
            rejectUnauthorized: true
        }
    });

    try {
        console.log('\nSending test email with enhanced headers...');
        const info = await transporter.sendMail({
            from: {
                name: 'RifasCAI Support',
                address: process.env.SMTP_USER
            },
            to: targetEmail,
            subject: 'RifasCAI Email System Test - Enhanced',
            priority: 'high',
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high',
                'List-Unsubscribe': `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`
            },
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <h2 style="color: #6a1b9a;">RifasCAI Email System Test - Enhanced</h2>
                    <p>This is an enhanced test email with additional headers to improve deliverability.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Configuration Details:</h3>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>✉️ From: ${process.env.SMTP_USER}</li>
                            <li>📨 To: ${targetEmail}</li>
                            <li>🕒 Time Sent: ${new Date().toLocaleString()}</li>
                            <li>🔒 Secure: ${process.env.SMTP_SECURE}</li>
                        </ul>
                    </div>
                    <p>If you received this email, it means the email system is working!</p>
                    <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                        To unsubscribe, reply with "unsubscribe" in the subject.
                    </p>
                </div>
            `
        });

        console.log('✓ Enhanced test email sent successfully!');
        console.log('Message details:', {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected
        });
        
        return info;

    } catch (error) {
        console.error('✖ Error:', error);
        throw error;
    }
}

// Run the test
sendTestEmailWithHeaders()
    .then(() => {
        console.log('\n✓ Enhanced email test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✖ Enhanced email test failed:', error.message);
        process.exit(1);
    });