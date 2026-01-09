const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ============== CONFIGURATION ==============
const CONFIG = {
    // Delay between groups (in milliseconds)
    // Random delay between minDelay and maxDelay for safety
    minDelay: 15000,  // 15 seconds minimum
    maxDelay: 30000,  // 30 seconds maximum

    // Language configurations (ordered - English first, then Tamil)
    languages: [
        {
            name: 'english',
            groupListFile: './groups-english-list.json',
            folder: './english',
            messageFile: 'english.txt'
        },
        {
            name: 'tamil',
            groupListFile: './groups-tamil-list.json',
            folder: './tamil',
            messageFile: 'tamil.txt'
        }
    ]
};

// ============== MAIN CODE ==============
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generate random delay for safety
function getRandomDelay() {
    return Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Find image file in a folder (any .jpg file)
function findImageInFolder(folder) {
    if (!fs.existsSync(folder)) {
        return null;
    }

    const files = fs.readdirSync(folder);
    const imageFile = files.find(file => file.toLowerCase().endsWith('.jpg'));

    if (imageFile) {
        return path.join(folder, imageFile);
    }
    return null;
}

// Upscale image to meet HD requirements (2560px width minimum)
async function upscaleImageForHD(imagePath) {
    const metadata = await sharp(imagePath).metadata();
    const currentWidth = metadata.width;

    // If already wide enough for HD, return original
    if (currentWidth >= 2560) {
        console.log(`   📏 Image is ${currentWidth}px wide - HD ready`);
        return imagePath;
    }

    // Calculate new dimensions maintaining aspect ratio
    const targetWidth = 2560;
    const scale = targetWidth / currentWidth;
    const targetHeight = Math.round(metadata.height * scale);

    console.log(`   📏 Upscaling from ${currentWidth}x${metadata.height}px to ${targetWidth}x${targetHeight}px`);

    // Create upscaled version
    const tempPath = imagePath.replace('.jpg', '-hd.jpg');
    await sharp(imagePath)
        .resize(targetWidth, targetHeight, {
            fit: 'contain',
            kernel: 'lanczos3' // High-quality upscaling algorithm
        })
        .jpeg({ quality: 95 }) // High quality JPEG
        .toFile(tempPath);

    return tempPath;
}

// Validate language configuration files
function validateLanguageConfig(lang, config) {
    const errors = [];

    // Check group list file
    if (!fs.existsSync(config.groupListFile)) {
        errors.push(`❌ Group list file not found: ${config.groupListFile}`);
    }

    // Check folder exists
    if (!fs.existsSync(config.folder)) {
        errors.push(`❌ Folder not found: ${config.folder}`);
    } else {
        // Check for image file
        const imagePath = findImageInFolder(config.folder);
        if (!imagePath) {
            errors.push(`❌ No .jpg image file found in: ${config.folder}`);
        }

        // Check for message file
        const messagePath = path.join(config.folder, config.messageFile);
        if (!fs.existsSync(messagePath)) {
            errors.push(`❌ Message file not found: ${messagePath}`);
        } else {
            const messageText = fs.readFileSync(messagePath, 'utf8').trim();
            if (!messageText) {
                errors.push(`❌ Message file is empty: ${messagePath}`);
            }
        }
    }

    return errors;
}

// Display QR code for login
client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\nOpen WhatsApp > Settings > Linked Devices > Link a Device\n');
});

// When authenticated
client.on('authenticated', () => {
    console.log('✅ Authenticated successfully!');
});

// When ready
client.on('ready', async () => {
    console.log('✅ WhatsApp client is ready!\n');

    // Check command line argument
    const command = process.argv[2];

    if (command === 'list') {
        await listGroups();
    } else if (command === 'send') {
        await sendToAllLanguages();
    } else if (command === 'status') {
        await sendToStatus();
    } else {
        console.log('Usage:');
        console.log('  node index.js list    - List all your groups');
        console.log('  node index.js send    - Send messages to all language groups');
        console.log('  node index.js status  - Post images to your WhatsApp status');
    }

    // Keep running for a bit then exit
    setTimeout(() => {
        console.log('\n👋 Done! Exiting...');
        process.exit(0);
    }, 5000);
});

// List all groups
async function listGroups() {
    console.log('📋 Fetching your groups...\n');

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    console.log(`Found ${groups.length} groups:\n`);
    console.log('─'.repeat(60));

    groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   ID: ${group.id._serialized}`);
        console.log('');
    });

    console.log('─'.repeat(60));
    console.log('\n💡 Add groups to groups-tamil-list.json and groups-english-list.json');

    // Save to file for reference
    const groupList = groups.map(g => ({
        name: g.name,
        id: g.id._serialized
    }));
    fs.writeFileSync('groups-list.json', JSON.stringify(groupList, null, 2));
    console.log('📁 Group list also saved to groups-list.json');
}

// Send images to WhatsApp Status
async function sendToStatus() {
    console.log('📸 Posting images to WhatsApp Status...\n');
    console.log('🔍 Validating configurations...\n');

    let hasErrors = false;

    // Validate all language configurations
    for (const langConfig of CONFIG.languages) {
        console.log(`Checking ${langConfig.name.toUpperCase()} configuration:`);
        const errors = validateLanguageConfig(langConfig.name, langConfig);

        if (errors.length > 0) {
            hasErrors = true;
            errors.forEach(error => console.log(`  ${error}`));
        } else {
            console.log(`  ✅ All files found for ${langConfig.name}`);
        }
        console.log('');
    }

    if (hasErrors) {
        console.log('❌ Please fix the above errors before posting to status.');
        return;
    }

    console.log('✅ All configurations validated successfully!\n');
    console.log('📤 Posting to status...\n');

    // Post each language status (English first, then Tamil)
    for (const langConfig of CONFIG.languages) {
        console.log('═'.repeat(60));
        console.log(`📨 Posting ${langConfig.name.toUpperCase()} status`);
        console.log('═'.repeat(60));

        // Find image file
        const imagePath = findImageInFolder(langConfig.folder);

        try {
            console.log(`📷 Image: ${path.basename(imagePath)}`);

            // Upscale image for HD quality
            const hdImagePath = await upscaleImageForHD(imagePath);

            // Create media from upscaled file
            const media = MessageMedia.fromFilePath(hdImagePath);

            console.log(`📝 Posting image to status...`);

            // Send to status
            await client.sendMessage('status@broadcast', media);

            console.log(`✅ ${langConfig.name.toUpperCase()} status posted successfully!\n`);

            // Clean up temporary upscaled file if created
            if (hdImagePath !== imagePath && fs.existsSync(hdImagePath)) {
                fs.unlinkSync(hdImagePath);
                console.log(`   🗑️  Cleaned up temporary HD file\n`);
            }

            // Wait a bit between status posts
            if (langConfig !== CONFIG.languages[CONFIG.languages.length - 1]) {
                console.log('⏳ Waiting 5 seconds before next status...\n');
                await sleep(5000);
            }
        } catch (error) {
            console.log(`❌ Failed to post ${langConfig.name} status: ${error.message}\n`);
        }
    }

    console.log('✅ All statuses posted!');
}

// Send to all language groups
async function sendToAllLanguages() {
    console.log('🔍 Validating configurations...\n');

    let hasErrors = false;
    const validationResults = {};

    // Validate all language configurations
    for (const langConfig of CONFIG.languages) {
        console.log(`Checking ${langConfig.name.toUpperCase()} configuration:`);
        const errors = validateLanguageConfig(langConfig.name, langConfig);

        if (errors.length > 0) {
            hasErrors = true;
            errors.forEach(error => console.log(`  ${error}`));
            validationResults[langConfig.name] = { valid: false, errors };
        } else {
            console.log(`  ✅ All files found for ${langConfig.name}`);
            validationResults[langConfig.name] = { valid: true };
        }
        console.log('');
    }

    if (hasErrors) {
        console.log('❌ Please fix the above errors before sending messages.');
        return;
    }

    console.log('✅ All configurations validated successfully!\n');
    console.log('📤 Starting to send messages...\n');

    // Get all groups from WhatsApp
    const chats = await client.getChats();
    const allGroups = chats.filter(chat => chat.isGroup);

    // Send to each language (English first, then Tamil)
    for (const langConfig of CONFIG.languages) {
        console.log('═'.repeat(60));
        console.log(`📨 Sending ${langConfig.name.toUpperCase()} messages`);
        console.log('═'.repeat(60));

        await sendToLanguageGroups(langConfig.name, langConfig, allGroups);
        console.log('');
    }

    console.log('✅ All messages sent!');
}

// Send to groups for a specific language
async function sendToLanguageGroups(lang, config, allGroups) {
    // Load group list for this language
    const groupList = JSON.parse(fs.readFileSync(config.groupListFile, 'utf8'));

    // Find image file and upscale for HD quality
    const imagePath = findImageInFolder(config.folder);
    console.log(`\n📷 Image: ${path.basename(imagePath)}`);

    // Upscale image for HD quality
    const hdImagePath = await upscaleImageForHD(imagePath);
    const media = MessageMedia.fromFilePath(hdImagePath);

    // Read message text
    const messagePath = path.join(config.folder, config.messageFile);
    const messageText = fs.readFileSync(messagePath, 'utf8').trim();

    console.log(`\n📝 Message preview:`);
    console.log('─'.repeat(40));
    console.log(messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
    console.log('─'.repeat(40));

    // Match groups from the list with actual WhatsApp groups
    const matchedGroups = [];
    for (const groupInfo of groupList) {
        const found = allGroups.find(g => g.id._serialized === groupInfo.id);
        if (found) {
            matchedGroups.push(found);
        } else {
            console.log(`⚠️  Group not found: "${groupInfo.name}" (${groupInfo.id})`);
        }
    }

    console.log(`📱 Found ${matchedGroups.length} of ${groupList.length} groups\n`);

    // Send to each group
    let successCount = 0;
    for (let i = 0; i < matchedGroups.length; i++) {
        const group = matchedGroups[i];

        try {
            console.log(`[${i + 1}/${matchedGroups.length}] Sending to: ${group.name}`);

            // Send Image with Caption (as a single message)
            console.log(`   📷 Sending image with caption...`);
            await client.sendMessage(group.id._serialized, media, {
                caption: messageText
            });

            console.log(`   ✅ Sent successfully!`);
            successCount++;

            // Random delay before next group (except for last one)
            if (i < matchedGroups.length - 1) {
                const delay = getRandomDelay();
                console.log(`   ⏳ Waiting ${Math.round(delay/1000)} seconds before next group...\n`);
                await sleep(delay);
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }

    // Clean up temporary upscaled file if created
    if (hdImagePath !== imagePath && fs.existsSync(hdImagePath)) {
        fs.unlinkSync(hdImagePath);
        console.log(`🗑️  Cleaned up temporary HD file`);
    }

    console.log(`\n✅ ${lang.toUpperCase()}: Sent to ${successCount}/${matchedGroups.length} groups`);
}

// Handle errors
client.on('auth_failure', (msg) => {
    console.log('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
});

// Start the client
console.log('🚀 Starting WhatsApp client...\n');
client.initialize();
