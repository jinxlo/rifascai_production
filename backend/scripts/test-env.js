const path = require('path');
const fs = require('fs');

// Define absolute path to .env
const envPath = 'C:\\Users\\Administrator\\Desktop\\RifasCAIv2-1\\backend\\.env';

console.log('Testing Email Configuration\n');
console.log('Environment File:');
console.log('Path:', envPath);
console.log('Exists:', fs.existsSync(envPath) ? 'Yes' : 'No');

if (fs.existsSync(envPath)) {
    // Load environment variables from the absolute path
    require('dotenv').config({ path: envPath });
    
    console.log('\nCurrent Environment Variables:');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '[PRESENT]' : '[MISSING]');
    console.log('SUPPORT_EMAIL:', process.env.SUPPORT_EMAIL);

    console.log('\nFile Contents (sensitive data hidden):');
    const envContent = fs.readFileSync(envPath, 'utf8')
        .split('\n')
        .map(line => {
            // Hide sensitive information
            if (line.toLowerCase().includes('pass')) {
                return line.split('=')[0] + '=[HIDDEN]';
            }
            return line;
        })
        .join('\n');
    console.log(envContent);
    
    // Validate all required variables are present
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.log('\n❌ Missing required variables:', missing.join(', '));
    } else {
        console.log('\n✓ All required variables are present');
    }
} else {
    console.error('\n❌ ERROR: .env file not found at specified location');
}