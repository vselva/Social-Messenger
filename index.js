const fs = require('fs');
const path = require('path');

// Check for help command and validate commands first (before loading other dependencies)
const command = process.argv[2];
const validCommands = ['send-all', 'send-wa', 'send-telegram', 'send-wa-status', 'wa-list', 'clean-images', 'queue-status', 'help', '-h', '--help'];

if (command === '-h' || command === '--help' || command === 'help' || !command) {
    console.log('Social Messenger - WhatsApp & Telegram\n');
    console.log('Usage: node index.js <command>\n');
    console.log('Commands:');
    console.log('  send-all       Send to WhatsApp status, groups, and Telegram (deletes content on success)');
    console.log('  send-wa        Send to WhatsApp groups only');
    console.log('  send-telegram  Send to Telegram groups only');
    console.log('  send-wa-status Post images to your WhatsApp status only');
    console.log('  wa-list        List all your WhatsApp groups');
    console.log('  queue-status   Show how many messages are queued');
    console.log('  clean-images   Delete content from queue or root folder');
    console.log('  help, -h       Show this help message\n');
    console.log('Queue Mode:');
    console.log('  Create queue/1/, queue/2/, etc. folders with e.jpg, t.jpg, english.txt, tamil.txt');
    console.log('  send-all will send from the lowest numbered folder and delete it on success\n');
    console.log('Examples:');
    console.log('  node index.js send-all');
    console.log('  node index.js send-telegram');
    console.log('  node index.js queue-status');
    process.exit(0);
}

// Validate command before doing anything else
if (!validCommands.includes(command)) {
    console.log(`❌ Unknown command: "${command}"\n`);
    console.log('Run "node index.js help" to see available commands.');
    process.exit(1);
}

// Handle queue-status command without loading dependencies
if (command === 'queue-status') {
    const queuePath = './queue';

    console.log('📬 Queue Status\n');

    if (!fs.existsSync(queuePath)) {
        console.log('   Queue folder does not exist (using root folder mode)');
        console.log('   To use queue mode, create queue/1/, queue/2/, etc.\n');
    } else {
        const entries = fs.readdirSync(queuePath, { withFileTypes: true });
        const numericFolders = entries
            .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
            .map(entry => parseInt(entry.name, 10))
            .sort((a, b) => a - b);

        if (numericFolders.length === 0) {
            console.log('   📭 Queue is empty\n');
        } else {
            console.log(`   📬 ${numericFolders.length} message(s) queued\n`);
            console.log('   Folders: ' + numericFolders.join(', '));
            console.log(`\n   Next to send: queue/${numericFolders[0]}/\n`);
        }
    }

    process.exit(0);
}

// Handle clean-images command without loading dependencies
if (command === 'clean-images') {
    const queuePath = './queue';
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const prefixes = ['e', 't'];

    console.log('🗑️  Cleaning up content...\n');

    // Check if queue folder exists
    if (fs.existsSync(queuePath)) {
        // Queue mode - delete the lowest numbered folder
        const entries = fs.readdirSync(queuePath, { withFileTypes: true });
        const numericFolders = entries
            .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
            .map(entry => parseInt(entry.name, 10))
            .sort((a, b) => a - b);

        if (numericFolders.length === 0) {
            console.log('   📭 Queue is empty - nothing to clean');
        } else {
            const folderToDelete = path.join(queuePath, numericFolders[0].toString());
            console.log(`   Deleting queue folder: ${folderToDelete}`);

            // Delete all files in the folder
            const files = fs.readdirSync(folderToDelete);
            for (const file of files) {
                fs.unlinkSync(path.join(folderToDelete, file));
                console.log(`   🗑️  Deleted: ${file}`);
            }

            // Remove the folder itself
            fs.rmdirSync(folderToDelete);
            console.log(`   🗑️  Removed folder: ${numericFolders[0]}/`);
        }
    } else {
        // Fallback mode - delete images from root
        let deletedCount = 0;
        const files = fs.readdirSync('.');

        for (const file of files) {
            const lower = file.toLowerCase();
            const name = path.parse(lower).name;
            const ext = path.parse(lower).ext;
            if (imageExtensions.includes(ext) && prefixes.includes(name)) {
                fs.unlinkSync(file);
                console.log(`   🗑️  Deleted: ${file}`);
                deletedCount++;
            }
        }

        if (deletedCount === 0) {
            console.log('   No content images found in root folder');
        }
    }

    console.log('\n✅ Done!');
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

    // Queue folder for multiple messages (optional - falls back to root if not present)
    queueFolder: './queue',

    // Language configurations (ordered - English first, then Tamil)
    // Content files: e.jpg/e.png for English, t.jpg/t.png for Tamil
    // Message files: english.txt, tamil.txt
    languages: [
        {
            name: 'english',
            groupListFile: './config/groups-english-list.json',
            messageFile: 'english.txt',
            imagePrefix: 'e',
            telegramGroupListFile: './config/telegram-groups-english-list.json'
        },
        {
            name: 'tamil',
            groupListFile: './config/groups-tamil-list.json',
            messageFile: 'tamil.txt',
            imagePrefix: 't',
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

// Loading spinner for initialization
let spinnerInterval = null;
function startSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write(`${message} ${frames[0]}`);
    spinnerInterval = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`${message} ${frames[i]}`);
    }, 80);
}

function stopSpinner(successMessage) {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        if (successMessage) {
            console.log(successMessage);
        }
    }
}

// Generate random delay for safety
function getRandomDelay() {
    return Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get content folder (queue mode or fallback to root)
// Returns: { folder: string|null, isQueue: boolean }
function getContentFolder() {
    const queuePath = CONFIG.queueFolder;

    // Check if queue folder exists
    if (!fs.existsSync(queuePath)) {
        // No queue folder - use root directory (fallback mode)
        return { folder: '.', isQueue: false };
    }

    // Queue folder exists - find lowest numbered subfolder
    const entries = fs.readdirSync(queuePath, { withFileTypes: true });
    const numericFolders = entries
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => parseInt(entry.name, 10))
        .sort((a, b) => a - b);

    if (numericFolders.length === 0) {
        // Queue folder exists but is empty
        return { folder: null, isQueue: true };
    }

    // Return the lowest numbered folder
    const lowestFolder = path.join(queuePath, numericFolders[0].toString());
    return { folder: lowestFolder, isQueue: true };
}

// Get queue status (for queue-status command)
function getQueueStatus() {
    const queuePath = CONFIG.queueFolder;

    if (!fs.existsSync(queuePath)) {
        return { exists: false, count: 0, folders: [] };
    }

    const entries = fs.readdirSync(queuePath, { withFileTypes: true });
    const numericFolders = entries
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => parseInt(entry.name, 10))
        .sort((a, b) => a - b);

    return {
        exists: true,
        count: numericFolders.length,
        folders: numericFolders
    };
}

// Delete a queue folder entirely
function deleteQueueFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return;
    }

    // Delete all files in the folder first
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        fs.unlinkSync(path.join(folderPath, file));
    }

    // Remove the folder itself
    fs.rmdirSync(folderPath);
    console.log(`   🗑️  Deleted queue folder: ${path.basename(folderPath)}`);
}

// Get chats with retry (WhatsApp internal data may not be ready immediately after 'ready' event)
async function getChatsWithRetry(maxRetries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const chats = await client.getChats();
            return chats;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`⚠️  getChats failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
                console.log(`   Retrying in ${Math.round(delayMs / 1000)} seconds...`);
                await sleep(delayMs);
            } else {
                throw error;
            }
        }
    }
}

// Find image file in a folder by prefix (e.g., prefix 'e' matches e.jpg, e.png, e.jpeg, e.webp)
function findImageInFolder(folder, prefix) {
    if (!fs.existsSync(folder)) {
        return null;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const files = fs.readdirSync(folder);
    const imageFile = files.find(file => {
        const lower = file.toLowerCase();
        const name = path.parse(lower).name;
        const ext = path.parse(lower).ext;
        return name === prefix && imageExtensions.includes(ext);
    });

    if (imageFile) {
        return path.join(folder, imageFile);
    }
    return null;
}

// Delete image files in a folder matching a prefix (keeps .txt files and other prefixes)
function deleteImagesInFolder(folder, prefix) {
    if (!fs.existsSync(folder)) {
        return;
    }

    const files = fs.readdirSync(folder);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    for (const file of files) {
        const lower = file.toLowerCase();
        const name = path.parse(lower).name;
        const ext = path.parse(lower).ext;
        if (imageExtensions.includes(ext) && name === prefix) {
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

    // Create upscaled version (preserve original format)
    const ext = path.extname(imagePath);
    const base = imagePath.slice(0, -ext.length);
    const tempPath = `${base}-hd${ext}`;
    let pipeline = sharp(imagePath)
        .resize(targetWidth, targetHeight, {
            fit: 'contain',
            kernel: 'lanczos3' // High-quality upscaling algorithm
        });
    if (ext.toLowerCase() === '.png') {
        pipeline = pipeline.png({ quality: 95 });
    } else {
        pipeline = pipeline.jpeg({ quality: 95 });
    }
    await pipeline.toFile(tempPath);

    return tempPath;
}

// Validate language configuration files
// folder: the content folder to check (from getContentFolder())
function validateLanguageConfig(lang, config, folder) {
    const errors = [];

    // Check group list file
    if (!fs.existsSync(config.groupListFile)) {
        errors.push(`❌ Group list file not found: ${config.groupListFile}`);
    }

    // Check folder exists
    if (!fs.existsSync(folder)) {
        errors.push(`❌ Content folder not found: ${folder}`);
    } else {
        // Check for image file by prefix
        const imagePath = findImageInFolder(folder, config.imagePrefix);
        if (!imagePath) {
            errors.push(`❌ No image file found for prefix '${config.imagePrefix}' in: ${folder}`);
        }

        // Check for message file
        const messagePath = path.join(folder, config.messageFile);
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
    stopSpinner();
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\nOpen WhatsApp > Settings > Linked Devices > Link a Device\n');
    startSpinner('   Waiting for scan');
});

// When authenticated (use 'once' to prevent duplicate messages)
client.once('authenticated', () => {
    stopSpinner('✅ Authenticated successfully!');
    startSpinner('   Loading WhatsApp data');
});

// When ready (use 'once' to prevent multiple executions if event fires multiple times)
client.once('ready', async () => {
    stopSpinner('✅ WhatsApp client is ready!\n');

    // Initialize Telegram bot
    const telegramReady = initTelegramBot();

    // Check command line argument
    const command = process.argv[2];

    if (command === 'wa-list') {
        await listGroups();
    } else if (command === 'send-all') {
        // Get content folder (queue mode or fallback)
        const { folder: contentFolder, isQueue } = getContentFolder();

        if (contentFolder === null) {
            console.log('📭 Queue folder is empty - no messages to send.');
        } else {
            if (isQueue) {
                console.log(`📬 Queue mode: Sending from ${contentFolder}\n`);
            }

            let allSuccess = true;

            // Send to WhatsApp status first
            const statusSuccess = await sendToStatus(contentFolder);
            if (!statusSuccess) allSuccess = false;

            // Send to WhatsApp groups
            const waSuccess = await sendToAllLanguages(contentFolder);
            if (!waSuccess) allSuccess = false;

            // Also send to Telegram if configured
            if (telegramReady) {
                const telegramSuccess = await sendToAllTelegramLanguages(contentFolder);
                if (!telegramSuccess) allSuccess = false;
            }

            // Cleanup on success
            if (allSuccess) {
                if (isQueue) {
                    console.log('\n🗑️  Cleaning up queue folder...');
                    deleteQueueFolder(contentFolder);
                } else {
                    console.log('\n🗑️  Cleaning up images...');
                    for (const langConfig of CONFIG.languages) {
                        deleteImagesInFolder(contentFolder, langConfig.imagePrefix);
                    }
                    console.log('🗑️  Clearing text files...');
                    for (const langConfig of CONFIG.languages) {
                        const txtPath = path.join(contentFolder, langConfig.messageFile);
                        if (fs.existsSync(txtPath)) {
                            fs.writeFileSync(txtPath, '');
                            console.log(`   🗑️  Cleared: ${langConfig.messageFile}`);
                        }
                    }
                }
                console.log('✅ Cleanup complete!');
            } else {
                console.log('\n⚠️  Some sends failed - content NOT deleted');
            }
        }
    } else if (command === 'send-wa') {
        // Get content folder (queue mode or fallback)
        const { folder: contentFolder, isQueue } = getContentFolder();

        if (contentFolder === null) {
            console.log('📭 Queue folder is empty - no messages to send.');
        } else {
            if (isQueue) {
                console.log(`📬 Queue mode: Sending from ${contentFolder}\n`);
            }
            // Send to WhatsApp groups only (no cleanup - use send-all for that)
            await sendToAllLanguages(contentFolder);
        }
    } else if (command === 'send-telegram') {
        // Get content folder (queue mode or fallback)
        const { folder: contentFolder, isQueue } = getContentFolder();

        if (contentFolder === null) {
            console.log('📭 Queue folder is empty - no messages to send.');
        } else {
            if (isQueue) {
                console.log(`📬 Queue mode: Sending from ${contentFolder}\n`);
            }
            if (telegramReady) {
                await sendToAllTelegramLanguages(contentFolder);
            } else {
                console.log('❌ Telegram bot not configured. Set TELEGRAM_BOT_TOKEN environment variable.');
            }
        }
    } else if (command === 'send-wa-status') {
        // Get content folder (queue mode or fallback)
        const { folder: contentFolder, isQueue } = getContentFolder();

        if (contentFolder === null) {
            console.log('📭 Queue folder is empty - no messages to send.');
        } else {
            if (isQueue) {
                console.log(`📬 Queue mode: Sending from ${contentFolder}\n`);
            }
            await sendToStatus(contentFolder);
        }
    } else {
        console.log('Usage:');
        console.log('  node index.js send-all       - Send to WhatsApp status, groups, and Telegram');
        console.log('  node index.js send-wa        - Send to WhatsApp groups only');
        console.log('  node index.js send-telegram  - Send to Telegram groups only');
        console.log('  node index.js send-wa-status - Post images to your WhatsApp status');
        console.log('  node index.js wa-list        - List all your WhatsApp groups');
        console.log('  node index.js queue-status   - Show queued message count');
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

    const chats = await getChatsWithRetry();
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
async function sendToStatus(contentFolder) {
    console.log('📸 Posting images to WhatsApp Status...\n');
    console.log('🔍 Validating configurations...\n');

    let hasErrors = false;

    // Validate all language configurations
    for (const langConfig of CONFIG.languages) {
        console.log(`Checking ${langConfig.name.toUpperCase()} configuration:`);
        const errors = validateLanguageConfig(langConfig.name, langConfig, contentFolder);

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

        // Find image file by prefix
        const imagePath = findImageInFolder(contentFolder, langConfig.imagePrefix);

        try {
            console.log(`📷 Image: ${path.basename(imagePath)}`);

            // Upscale image for HD quality
            const hdImagePath = await upscaleImageForHD(imagePath);

            // Create media from upscaled file
            const media = MessageMedia.fromFilePath(hdImagePath);

            console.log(`📝 Posting image to status...`);

            // Send to status (sendSeen: false to avoid markedUnread bug)
            await client.sendMessage('status@broadcast', media, { sendSeen: false });

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
async function sendToAllLanguages(contentFolder) {
    console.log('🔍 Validating configurations...\n');

    let hasErrors = false;
    const validationResults = {};

    // Validate all language configurations
    for (const langConfig of CONFIG.languages) {
        console.log(`Checking ${langConfig.name.toUpperCase()} configuration:`);
        const errors = validateLanguageConfig(langConfig.name, langConfig, contentFolder);

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

    let allSuccess = true;

    // Send to each language (English first, then Tamil)
    for (const langConfig of CONFIG.languages) {
        console.log('═'.repeat(60));
        console.log(`📨 Sending ${langConfig.name.toUpperCase()} messages`);
        console.log('═'.repeat(60));

        const success = await sendToLanguageGroups(langConfig.name, langConfig, contentFolder);
        if (!success) allSuccess = false;
        console.log('');
    }

    console.log('✅ All messages sent!');
    return allSuccess;
}

// Send to groups for a specific language (sends directly by group ID from config)
async function sendToLanguageGroups(lang, config, contentFolder) {
    // Load group list for this language
    const groupList = JSON.parse(fs.readFileSync(config.groupListFile, 'utf8'));

    // Find image file by prefix and upscale for HD quality
    const imagePath = findImageInFolder(contentFolder, config.imagePrefix);
    console.log(`\n📷 Image: ${path.basename(imagePath)}`);

    // Upscale image for HD quality
    const hdImagePath = await upscaleImageForHD(imagePath);
    const media = MessageMedia.fromFilePath(hdImagePath);

    // Read message text
    const messagePath = path.join(contentFolder, config.messageFile);
    const messageText = fs.readFileSync(messagePath, 'utf8').trim();

    console.log(`\n📝 Message preview:`);
    console.log('─'.repeat(40));
    console.log(messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
    console.log('─'.repeat(40));

    console.log(`📱 Sending to ${groupList.length} groups\n`);

    // Send to each group directly by ID
    let successCount = 0;
    for (let i = 0; i < groupList.length; i++) {
        const group = groupList[i];

        try {
            console.log(`[${i + 1}/${groupList.length}] Sending to: ${group.name}`);

            // Send Image with Caption (as a single message)
            // sendSeen: false to avoid markedUnread bug in whatsapp-web.js
            console.log(`   📷 Sending image with caption...`);
            await client.sendMessage(group.id, media, {
                caption: messageText,
                sendSeen: false
            });

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

    // Clean up temporary upscaled file if created
    if (hdImagePath !== imagePath && fs.existsSync(hdImagePath)) {
        fs.unlinkSync(hdImagePath);
        console.log(`🗑️  Cleaned up temporary HD file`);
    }

    console.log(`\n✅ ${lang.toUpperCase()}: Sent to ${successCount}/${groupList.length} groups`);

    // Return true only if all groups received the message
    return successCount === groupList.length;
}

// ============== TELEGRAM FUNCTIONS ==============

// Convert WhatsApp formatting to Telegram Markdown
function convertWhatsAppToTelegram(text) {
    // Convert triple backticks to italic (underscore) for Telegram
    // ```text``` -> _text_
    return text.replace(/```([^`]+)```/g, '_$1_');
}

// Validate Telegram configuration for a language
// folder: the content folder to check (from getContentFolder())
function validateTelegramConfig(lang, config, folder) {
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
    if (!fs.existsSync(folder)) {
        errors.push(`❌ Content folder not found: ${folder}`);
    } else {
        // Check for image file by prefix
        const imagePath = findImageInFolder(folder, config.imagePrefix);
        if (!imagePath) {
            errors.push(`❌ No image file found for prefix '${config.imagePrefix}' in: ${folder}`);
        }

        // Check for message file
        const messagePath = path.join(folder, config.messageFile);
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
async function sendToAllTelegramLanguages(contentFolder) {
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
        const errors = validateTelegramConfig(langConfig.name, langConfig, contentFolder);

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

        const success = await sendToTelegramGroups(langConfig.name, langConfig, contentFolder);
        if (!success) allSuccess = false;
        console.log('');
    }

    console.log('✅ All Telegram messages sent!');
    return allSuccess;
}

// Send to Telegram groups for a specific language
async function sendToTelegramGroups(lang, config, contentFolder) {
    // Load Telegram group list for this language
    const groupList = JSON.parse(fs.readFileSync(config.telegramGroupListFile, 'utf8'));

    if (groupList.length === 0) {
        console.log(`⚠️  No Telegram groups configured for ${lang}`);
        return true; // No groups to send to, consider it success
    }

    // Find image file by prefix
    const imagePath = findImageInFolder(contentFolder, config.imagePrefix);
    console.log(`\n📷 Image: ${path.basename(imagePath)}`);

    // Read message text
    const messagePath = path.join(contentFolder, config.messageFile);
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
    stopSpinner();
    console.log('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    stopSpinner();
    console.log('❌ Disconnected:', reason);
});

// Handle commands that don't need WhatsApp
if (command === 'send-telegram') {
    (async () => {
        console.log('📱 TELEGRAM ONLY MODE\n');

        // Get content folder (queue mode or fallback)
        const { folder: contentFolder, isQueue } = getContentFolder();

        if (contentFolder === null) {
            console.log('📭 Queue folder is empty - no messages to send.');
        } else {
            if (isQueue) {
                console.log(`📬 Queue mode: Sending from ${contentFolder}\n`);
            }

            const telegramReady = initTelegramBot();
            if (telegramReady) {
                await sendToAllTelegramLanguages(contentFolder);
            } else {
                console.log('❌ Telegram bot not configured. Set TELEGRAM_BOT_TOKEN in .env file.');
            }
        }

        console.log('\n👋 Done! Exiting...');
        process.exit(0);
    })();
} else {
    // Start WhatsApp client for other commands
    console.log('🚀 Starting WhatsApp client...\n');
    startSpinner('   Connecting to WhatsApp Web');
    client.initialize();
}
