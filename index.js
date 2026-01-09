const fs = require('fs');
const path = require('path');

// Check for help command first (before loading other dependencies)
const command = process.argv[2];
if (command === '-h' || command === '--help' || command === 'help' || !command) {
    console.log('Social Messenger - WhatsApp & Telegram\n');
    console.log('Usage: node index.js <command>\n');
    console.log('Commands:');
    console.log('  send-all       Send to WhatsApp status, groups, and Telegram (deletes images on success)');
    console.log('  send-wa        Send to WhatsApp groups only');
    console.log('  send-telegram  Send to Telegram groups only');
    console.log('  send-wa-status Post images to your WhatsApp status only');
    console.log('  wa-list        List all your WhatsApp groups');
    console.log('  clean-images   Delete all images from tamil/ and english/ folders');
    console.log('  help, -h       Show this help message\n');
    console.log('Examples:');
    console.log('  node index.js send-all');
    console.log('  node index.js send-telegram');
    console.log('  node index.js clean-images');
    process.exit(0);
}

// Handle clean-images command without loading dependencies
if (command === 'clean-images') {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const folders = ['./english', './tamil'];

    console.log('🗑️  Cleaning up images from language folders...\n');

    for (const folder of folders) {
        if (!fs.existsSync(folder)) {
            console.log(`⚠️  Folder not found: ${folder}`);
            continue;
        }

        console.log(`📁 ${folder}:`);
        const files = fs.readdirSync(folder);
        let deletedCount = 0;

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (imageExtensions.includes(ext)) {
                const filePath = path.join(folder, file);
                fs.unlinkSync(filePath);
                console.log(`   🗑️  Deleted: ${file}`);
                deletedCount++;
            }
        }

        if (deletedCount === 0) {
            console.log('   No images found');
        }
        console.log('');
    }

    console.log('✅ Done!');
    process.exit(0);
}

// Load dependencies only when needed
require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');

// ============== CONFIGURATION ==============
const CONFIG = {
    // Delay between groups (in milliseconds)
    // Random delay between minDelay and maxDelay for safety
    minDelay: 15000,  // 15 seconds minimum
    maxDelay: 30000,  // 30 seconds maximum

    // Telegram Bot Token (get from @BotFather on Telegram)
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',

    // Language configurations (ordered - English first, then Tamil)
    languages: [
        {
            name: 'english',
            groupListFile: './config/groups-english-list.json',
            folder: './english',
            messageFile: 'english.txt',
            telegramGroupListFile: './config/telegram-groups-english-list.json'
        },
        {
            name: 'tamil',
            groupListFile: './config/groups-tamil-list.json',
            folder: './tamil',
            messageFile: 'tamil.txt',
            telegramGroupListFile: './config/telegram-groups-tamil-list.json'
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

// Initialize Telegram Bot (only if token is configured)
let telegramBot = null;
function initTelegramBot() {
    if (CONFIG.telegramBotToken && CONFIG.telegramBotToken !== 'YOUR_BOT_TOKEN_HERE') {
        telegramBot = new TelegramBot(CONFIG.telegramBotToken, { polling: false });
        console.log('✅ Telegram bot initialized');
        return true;
    }
    console.log('⚠️  Telegram bot token not configured - skipping Telegram');
    return false;
}

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

// Delete all image files in a folder (keeps .txt files)
function deleteImagesInFolder(folder) {
    if (!fs.existsSync(folder)) {
        return;
    }

    const files = fs.readdirSync(folder);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext)) {
            const filePath = path.join(folder, file);
            fs.unlinkSync(filePath);
            console.log(`   🗑️  Deleted: ${file}`);
        }
    }
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

    // Initialize Telegram bot
    const telegramReady = initTelegramBot();

    // Check command line argument
    const command = process.argv[2];

    if (command === 'wa-list') {
        await listGroups();
    } else if (command === 'send-all') {
        let allSuccess = true;

        // Send to WhatsApp status first
        const statusSuccess = await sendToStatus();
        if (!statusSuccess) allSuccess = false;

        // Send to WhatsApp groups
        const waSuccess = await sendToAllLanguages();
        if (!waSuccess) allSuccess = false;

        // Also send to Telegram if configured
        if (telegramReady) {
            const telegramSuccess = await sendToAllTelegramLanguages();
            if (!telegramSuccess) allSuccess = false;
        }

        // Delete images only if all sends were successful
        if (allSuccess) {
            console.log('\n🗑️  Cleaning up images from language folders...');
            for (const langConfig of CONFIG.languages) {
                deleteImagesInFolder(langConfig.folder);
            }
            console.log('✅ All images deleted successfully!');
        } else {
            console.log('\n⚠️  Some sends failed - images NOT deleted');
        }
    } else if (command === 'send-wa') {
        // Send to WhatsApp groups only
        await sendToAllLanguages();
    } else if (command === 'send-telegram') {
        // Send to Telegram only
        if (telegramReady) {
            await sendToAllTelegramLanguages();
        } else {
            console.log('❌ Telegram bot not configured. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
    } else if (command === 'send-wa-status') {
        await sendToStatus();
    } else {
        console.log('Usage:');
        console.log('  node index.js send-all       - Send to WhatsApp status, groups, and Telegram');
        console.log('  node index.js send-wa        - Send to WhatsApp groups only');
        console.log('  node index.js send-telegram  - Send to Telegram groups only');
        console.log('  node index.js send-wa-status - Post images to your WhatsApp status');
        console.log('  node index.js wa-list        - List all your WhatsApp groups');
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
    fs.writeFileSync('./config/groups-list.json', JSON.stringify(groupList, null, 2));
    console.log('📁 Group list also saved to config/groups-list.json');
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
        return false;
    }

    console.log('✅ All configurations validated successfully!\n');
    console.log('📤 Posting to status...\n');

    let allSuccess = true;

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
            allSuccess = false;
        }
    }

    console.log('✅ All statuses posted!');
    return allSuccess;
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
        return false;
    }

    console.log('✅ All configurations validated successfully!\n');
    console.log('📤 Starting to send messages...\n');

    // Get all groups from WhatsApp
    const chats = await client.getChats();
    const allGroups = chats.filter(chat => chat.isGroup);

    let allSuccess = true;

    // Send to each language (English first, then Tamil)
    for (const langConfig of CONFIG.languages) {
        console.log('═'.repeat(60));
        console.log(`📨 Sending ${langConfig.name.toUpperCase()} messages`);
        console.log('═'.repeat(60));

        const success = await sendToLanguageGroups(langConfig.name, langConfig, allGroups);
        if (!success) allSuccess = false;
        console.log('');
    }

    console.log('✅ All messages sent!');
    return allSuccess;
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

    // Return true only if all groups received the message
    return successCount === matchedGroups.length;
}

// ============== TELEGRAM FUNCTIONS ==============

// Convert WhatsApp formatting to Telegram Markdown
function convertWhatsAppToTelegram(text) {
    // Convert triple backticks to italic (underscore) for Telegram
    // ```text``` -> _text_
    return text.replace(/```([^`]+)```/g, '_$1_');
}

// Validate Telegram configuration for a language
function validateTelegramConfig(lang, config) {
    const errors = [];

    // Check telegram group list file
    if (!config.telegramGroupListFile) {
        errors.push(`❌ Telegram group list file not configured for ${lang}`);
        return errors;
    }

    if (!fs.existsSync(config.telegramGroupListFile)) {
        errors.push(`❌ Telegram group list file not found: ${config.telegramGroupListFile}`);
        return errors;
    }

    // Check folder exists (same as WhatsApp - shares content)
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

// Send to all Telegram groups for all languages
async function sendToAllTelegramLanguages() {
    console.log('\n📱 TELEGRAM MESSAGING\n');
    console.log('🔍 Validating Telegram configurations...\n');

    let hasErrors = false;

    // Validate all language configurations for Telegram
    for (const langConfig of CONFIG.languages) {
        if (!langConfig.telegramGroupListFile) {
            console.log(`⚠️  ${langConfig.name.toUpperCase()}: No Telegram group list configured - skipping`);
            continue;
        }

        console.log(`Checking ${langConfig.name.toUpperCase()} Telegram configuration:`);
        const errors = validateTelegramConfig(langConfig.name, langConfig);

        if (errors.length > 0) {
            hasErrors = true;
            errors.forEach(error => console.log(`  ${error}`));
        } else {
            console.log(`  ✅ All files found for ${langConfig.name} Telegram`);
        }
        console.log('');
    }

    if (hasErrors) {
        console.log('❌ Please fix the above Telegram errors before sending messages.');
        return false;
    }

    console.log('✅ All Telegram configurations validated successfully!\n');
    console.log('📤 Starting to send Telegram messages...\n');

    let allSuccess = true;

    // Send to each language
    for (const langConfig of CONFIG.languages) {
        if (!langConfig.telegramGroupListFile || !fs.existsSync(langConfig.telegramGroupListFile)) {
            continue;
        }

        console.log('═'.repeat(60));
        console.log(`📨 Sending ${langConfig.name.toUpperCase()} Telegram messages`);
        console.log('═'.repeat(60));

        const success = await sendToTelegramGroups(langConfig.name, langConfig);
        if (!success) allSuccess = false;
        console.log('');
    }

    console.log('✅ All Telegram messages sent!');
    return allSuccess;
}

// Send to Telegram groups for a specific language
async function sendToTelegramGroups(lang, config) {
    // Load Telegram group list for this language
    const groupList = JSON.parse(fs.readFileSync(config.telegramGroupListFile, 'utf8'));

    if (groupList.length === 0) {
        console.log(`⚠️  No Telegram groups configured for ${lang}`);
        return true; // No groups to send to, consider it success
    }

    // Find image file
    const imagePath = findImageInFolder(config.folder);
    console.log(`\n📷 Image: ${path.basename(imagePath)}`);

    // Read message text
    const messagePath = path.join(config.folder, config.messageFile);
    const messageText = fs.readFileSync(messagePath, 'utf8').trim();

    console.log(`\n📝 Message preview:`);
    console.log('─'.repeat(40));
    console.log(messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
    console.log('─'.repeat(40));

    console.log(`\n📱 Sending to ${groupList.length} Telegram groups\n`);

    // Send to each group
    let successCount = 0;
    for (let i = 0; i < groupList.length; i++) {
        const group = groupList[i];

        try {
            console.log(`[${i + 1}/${groupList.length}] Sending to: ${group.name}`);

            // Send photo with caption to Telegram
            console.log(`   📷 Sending image with caption...`);
            const telegramText = convertWhatsAppToTelegram(messageText);
            const options = {
                caption: telegramText,
                parse_mode: 'Markdown'
            };
            // If topic/thread ID is specified (for Forum groups), add it
            if (group.topicId) {
                options.message_thread_id = group.topicId;
            }
            await telegramBot.sendPhoto(group.chatId, imagePath, options);

            console.log(`   ✅ Sent successfully!`);
            successCount++;

            // Random delay before next group (except for last one)
            if (i < groupList.length - 1) {
                const delay = getRandomDelay();
                console.log(`   ⏳ Waiting ${Math.round(delay/1000)} seconds before next group...\n`);
                await sleep(delay);
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }

    console.log(`\n✅ ${lang.toUpperCase()} Telegram: Sent to ${successCount}/${groupList.length} groups`);

    // Return true only if all groups received the message
    return successCount === groupList.length;
}

// Handle errors
client.on('auth_failure', (msg) => {
    console.log('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
});

// Handle commands that don't need WhatsApp
if (command === 'send-telegram') {
    (async () => {
        console.log('📱 TELEGRAM ONLY MODE\n');
        const telegramReady = initTelegramBot();
        if (telegramReady) {
            await sendToAllTelegramLanguages();
        } else {
            console.log('❌ Telegram bot not configured. Set TELEGRAM_BOT_TOKEN in .env file.');
        }
        console.log('\n👋 Done! Exiting...');
        process.exit(0);
    })();
} else {
    // Start WhatsApp client for other commands
    console.log('🚀 Starting WhatsApp client...\n');
    client.initialize();
}
