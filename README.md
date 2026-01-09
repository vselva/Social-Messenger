# Social Messenger - WhatsApp & Telegram

Send daily spiritual images + text messages to multiple WhatsApp and Telegram groups safely, with support for multiple languages.

**Sends image with caption in a single message to each group**

---

## 📋 Prerequisites

You need to install **Node.js** on your computer first.

### Windows:
1. Go to https://nodejs.org/
2. Download the **LTS** version (recommended)
3. Run the installer, click Next through all steps
4. Restart your computer

### To verify installation:
Open Command Prompt (CMD) or Terminal and type:
```
node --version
```
You should see something like `v18.17.0` or higher.

---

## 🚀 Step-by-Step Setup

### Step 1: Download or Clone the Project

Create a folder on your computer (e.g., `C:\whatsapp-sender` on Windows or `~/whatsapp-sender` on Mac/Linux)

The project should have these files:
- `index.js` - Main script
- `package.json` - Dependencies configuration
- `README.md` - This file

### Step 2: Open Terminal/Command Prompt

**Windows:**
- Press `Win + R`, type `cmd`, press Enter
- Navigate to your folder: `cd C:\whatsapp-sender`

**Mac/Linux:**
- Open Terminal
- Navigate to your folder: `cd ~/whatsapp-sender`

### Step 3: Install Dependencies

Run this command:
```
npm install
```

Wait for it to complete (may take 1-2 minutes).

**Note:** This will install:
- `whatsapp-web.js v1.34.3` - HD quality support for status posts
- `node-telegram-bot-api` - Telegram bot integration
- `sharp` - Automatic image upscaling for HD quality

### Step 4: Set Up Language Folders

The script supports multiple languages. For each language, create a folder structure:

```
whatsapp-sender/
├── tamil/
│   ├── tamil.txt          # Your Tamil message
│   └── [any-name].jpg     # Your Tamil image (.jpg file)
└── english/
    ├── english.txt        # Your English message
    └── [any-name].jpg     # Your English image (.jpg file)
```

**Important:**
- The message file must be named exactly as configured: `tamil.txt` or `english.txt`
- The image should be a `.jpg` file
- **For best status quality:** Use high-resolution images (at least 2560px wide) for HD posting

### Step 5: Get Your Group List

Run this command:
```
node index.js list
```

1. A QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings > Linked Devices > Link a Device**
4. Scan the QR code
5. Wait for "WhatsApp client is ready!"
6. You'll see a list of all your groups with their IDs

The groups will be saved to `groups-list.json` for reference.

### Step 6: Configure Your Groups by Language

Create two JSON files for your group lists:

**`groups-tamil-list.json`** - Groups that should receive Tamil messages:
```json
[
    {
        "name": "Tamil Group 1",
        "id": "1234567890-1234567890@g.us"
    },
    {
        "name": "Tamil Group 2",
        "id": "1234567890-1234567890@g.us"
    }
]
```

**`groups-english-list.json`** - Groups that should receive English messages:
```json
[
    {
        "name": "English Group 1",
        "id": "1234567890-1234567890@g.us"
    },
    {
        "name": "English Group 2",
        "id": "1234567890-1234567890@g.us"
    }
]
```

Copy the exact group IDs from `groups-list.json` that was generated in Step 5.

### Step 7: Set Up Telegram Bot (Optional)

To send messages to Telegram groups, you need to create a Telegram bot:

#### A. Create a Bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the prompts to name your bot
4. Copy the **Bot Token** (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### B. Configure the Bot Token

**Option 1: Using .env file (Recommended)**
1. Copy `.env.example` to `.env`
2. Edit `.env` and replace `your_bot_token_here` with your actual token:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

**Option 2: Environment Variable**
```bash
# Windows CMD
set TELEGRAM_BOT_TOKEN=your_bot_token_here

# Windows PowerShell
$env:TELEGRAM_BOT_TOKEN="your_bot_token_here"

# Linux/Mac
export TELEGRAM_BOT_TOKEN=your_bot_token_here
```

#### C. Get Your Telegram Group/Channel Chat IDs

1. Add your bot to the Telegram group/channel as an admin
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find the `chat.id` in the response (negative number for groups, e.g., `-1001234567890`)

#### D. Configure Telegram Groups

**`telegram-groups-english-list.json`** - Telegram groups for English messages:
```json
[
    {
        "name": "English Telegram Group",
        "chatId": "-1001234567890"
    }
]
```

**`telegram-groups-tamil-list.json`** - Telegram groups for Tamil messages:
```json
[
    {
        "name": "Tamil Telegram Group",
        "chatId": "-1001234567890"
    }
]
```

**For Forum Groups (with Topics):**

If your Telegram group is a Forum group (supergroup with multiple topics), you need to specify the `topicId` to send messages to a specific topic instead of "General":

```json
[
    {
        "name": "Tamil Forum Topic",
        "chatId": "-1001234567890",
        "topicId": 6320
    }
]
```

**How to find the topicId:**
1. Open the Telegram group in Telegram Web (https://web.telegram.org)
2. Click on the specific topic you want to post to
3. Look at the URL: `https://web.telegram.org/a/#-1001234567890_6320`
4. The number after the underscore (`6320`) is the `topicId`

**Notes:**
- The `chatId` is a negative number for groups/channels
- The `topicId` is only needed for Forum groups - omit it for regular groups
- Make sure your bot is added as an **admin** to send messages
- WhatsApp formatting (`*bold*`, ``` ```italic``` ```) is automatically converted to Telegram format

---

## 📅 Daily Usage (Every Day)

### Step 1: Update Your Tamil Content
In the `tamil/` folder:
- Update or replace the `.jpg` image file with today's Tamil image
- Update `tamil.txt` with today's Tamil message

### Step 2: Update Your English Content
In the `english/` folder:
- Update or replace the `.jpg` image file with today's English image
- Update `english.txt` with today's English message

**💡 Tip for Better Status Quality:**
Use high-resolution images (at least 2560 pixels wide) for best status quality. The script automatically posts in HD mode when using whatsapp-web.js v1.34.3+.

**Example message format (tamil.txt):**
```
பொது விதி - 9.4:

கேழ்வரகு, வரகு, தினை, சாமை, பருப்புவகை முதலிய விலக்குகளை நீக்குதல்.

- திருவருட்பிரகாச வள்ளலார்
(நித்திய கரும விதி - பொது விதி)
```

### Step 3A: Post to WhatsApp Status (Optional)
If you want to post the images to your WhatsApp Status first:
```
node index.js status
```

**What happens:**
1. Validates all configurations (image files exist)
2. Posts English image (image only, no text) to your status in **HD quality**
3. Waits 5 seconds
4. Posts Tamil image (image only, no text) to your status in **HD quality**
5. Total time: ~10 seconds

**📸 Status Image Quality:**
- The script **automatically upscales** your images to 2560px width for HD quality
- Uses high-quality upscaling (Lanczos3 algorithm) to preserve detail
- Original images are not modified - upscaling is done on-the-fly
- Temporary upscaled files are automatically cleaned up after posting
- Quality should now match manual posting via web.whatsapp.com

### Step 3B: Send Messages to Groups
Open terminal/CMD in the folder and run:
```
node index.js send
```

**What happens:**
1. Validates all configurations (files exist, not empty)
2. For English groups (13 groups):
   - Sends IMAGE + CAPTION to English Group 1
   - Waits 15-30 seconds (random)
   - Repeats for all English groups (~3-6 minutes)
3. For Tamil groups (12 groups):
   - Sends IMAGE + CAPTION to Tamil Group 1
   - Waits 15-30 seconds (random)
   - Repeats for all Tamil groups (~3-6 minutes)
4. Total time: ~6-12 minutes for all 25 groups

**Tip:** You can run both commands together if you want:
```
node index.js status && node index.js send
```
This will first post to status, then send to all groups.

---

## 📁 Project Structure

```
social-messenger/
├── index.js                           # Main script
├── package.json                       # Dependencies
├── README.md                          # This file
├── .gitignore                         # Git ignore rules
├── groups-tamil-list.json             # WhatsApp Tamil groups
├── groups-english-list.json           # WhatsApp English groups
├── telegram-groups-tamil-list.json    # Telegram Tamil groups
├── telegram-groups-english-list.json  # Telegram English groups
├── groups-list.json                   # Generated list of all WhatsApp groups
├── tamil/
│   ├── tamil.txt                      # Daily Tamil message
│   └── [date]-tamil.jpg               # Daily Tamil image
├── english/
│   ├── english.txt                    # Daily English message
│   └── [date]-english.jpg             # Daily English image
├── .wwebjs_auth/                      # Auto-generated (WhatsApp session)
└── .wwebjs_cache/                     # Auto-generated (WhatsApp cache)
```

---

## 🎯 Features

- **Multi-platform Support**: Send to both WhatsApp and Telegram from a single tool
- **Multi-language Support**: Send different messages to different group sets (English & Tamil)
- **WhatsApp Status**: Post images with captions to your WhatsApp Status
- **Image with Caption**: Sends image and text as a single combined message
- **Safety Delays**: Random delays (15-30 seconds) between groups
- **Validation**: Checks all files before sending
- **Easy Configuration**: Simple JSON files for group management
- **Persistent Login**: Saves WhatsApp session (no need to scan QR every time)
- **Multiple Commands**: List groups, send to groups, or post to status
- **Flexible Sending**: Send to WhatsApp only, Telegram only, or both

---

## ⚠️ Safety Tips

1. **Don't send more than once per day** to the same groups
2. **Run manually** - don't set up auto-scheduling
3. **Keep delays enabled** - don't reduce the delay times
4. **Stop if you see warnings** from WhatsApp
5. **Test first** with one or two groups before sending to all

---

## ⚙️ Configuration

You can modify the delays and language order in [index.js](index.js) if needed:

```javascript
const CONFIG = {
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
```

**Note:** Messages are sent in the order listed above (English first, then Tamil). The 15-30 second delay provides a good balance between speed (~6-12 minutes total) and safety against WhatsApp spam detection.

---

## 🔧 Troubleshooting

### "QR code keeps appearing"
- Delete the `.wwebjs_auth` folder and try again
- Make sure WhatsApp is open on your phone
- Ensure your phone has a stable internet connection

### "Group not found"
- Run `node index.js list` to get the latest group list
- Check that the group IDs in your JSON files are correct
- Make sure you copied the exact ID from `groups-list.json`

### "Image not found" or "Message file not found"
- Check that the folder exists: `tamil/` or `english/`
- Ensure the message file is named correctly: `tamil.txt` or `english.txt`
- Verify there's at least one `.jpg` file in the folder

### "Message file is empty"
- Open the text file and add your message
- Make sure you saved the file after editing

### "puppeteer error" (common on first install)
Run this command:
```
npm install puppeteer --save
```

If on Linux, you may need additional dependencies:
```
sudo apt-get install -y libgbm-dev
```

### Commands not working on Windows
Make sure you're using Command Prompt (CMD) or PowerShell, not Git Bash.

### Status image quality is poor (but group messages look fine)
First, ensure you've upgraded to the latest version:
```bash
npm install
```

The script now uses HD quality mode (requires whatsapp-web.js v1.34.3+). To get the best quality:
- **Use high-resolution images** - At least 2560px wide for HD to activate
- Check your image dimensions: Right-click image → Properties → Details
- Smaller images will post in standard quality regardless of settings
- If still poor quality after upgrade, your images may be too small for HD mode

---

## 📝 Available Commands

You can run these commands:

```bash
# Send to everything: WhatsApp status + WhatsApp groups + Telegram groups
# (Automatically deletes images on success)
node index.js send-all

# Send to WhatsApp groups only
node index.js send-wa

# Send to Telegram groups only
node index.js send-telegram

# Post images to your WhatsApp Status only
node index.js send-wa-status

# List all your WhatsApp groups
node index.js wa-list

# Delete all images from tamil/ and english/ folders
node index.js clean-images

# Show help
node index.js -h
```

---

## 🙏 For Your Spiritual Service

This tool is designed for sending meaningful content like Vallalar's teachings.
Use it responsibly and spread positivity!

வள்ளலார் அருள் பெருக! 🙏
