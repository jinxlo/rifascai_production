const nodemailer = require('nodemailer');
const path = require('path');
const dns = require('dns').promises;

// Load environment variables from the correct location
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testEmailConfiguration() {
    console.log('\nStarting Email Connection Test...\n');

    // 1. DNS Resolution Test
    console.log('1. Testing DNS Resolution for SMTP host...');
    try {
        const addresses = await dns.resolve(process.env.SMTP_HOST);
        console.log('✓ DNS Resolution successful:', addresses);
    } catch (error) {
        console.error('✖ DNS Resolution failed:', error.message);
    }

    // 2. Create Transporter
    console.log('\n2. Creating SMTP Transporter...');
    const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        debug: true,
        logger: true,
        // Add timeout settings
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000
    };

    console.log('Transport configuration:', {
        ...config,
        auth: { user: config.auth.user, pass: '********' }
    });

    const transporter = nodemailer.createTransport(config);

    // 3. Verify Connection
    console.log('\n3. Verifying SMTP Connection...');
    try {
        const verifyResult = await transporter.verify();
        console.log('✓ SMTP Connection verified successfully');
    } catch (error) {
        console.error('✖ SMTP Connection failed:', {
            message: error.message,
            code: error.code,
            command: error.command,
            responseCode: error.responseCode
        });
        throw error;
    }

    // 4. Send Test Email
    console.log('\n4. Attempting to send test email...');
    try {
        const info = await transporter.sendMail({
            from: `"RifasCAI Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: 'SMTP Configuration Test',
            text: 'If you receive this email, the SMTP configuration is working correctly.',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>SMTP Configuration Test</h2>
                    <p>If you receive this email, the SMTP configuration is working correctly.</p>
                    <p>Configuration details:</p>
                    <ul>
                        <li>Host: ${process.env.SMTP_HOST}</li>
                        <li>Port: ${process.env.SMTP_PORT}</li>
                        <li>Secure: ${process.env.SMTP_SECURE}</li>
                        <li>User: ${process.env.SMTP_USER}</li>
                        <li>Time: ${new Date().toISOString()}</li>
                    </ul>
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
    } catch (error) {
        console.error('✖ Error sending test email:', {
            message: error.message,
            code: error.code,
            command: error.command,
            responseCode: error.responseCode
        });
        throw error;
    }
}

// Run the test
testEmailConfiguration()
    .then(() => {
        console.log('\n✓ All email tests completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n✖ Email test failed:', error.message);
        process.exit(1);
    });