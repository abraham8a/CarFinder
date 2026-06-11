# ⚡ Quick Start Guide

## 5-Minute Setup

### Step 1: Create Repository (GitHub)

1. Go to <https://github.com/new>
1. Repository name: `vehicle-finder-bot`
1. Owner: `abraham8a`
1. Public (Actions work better)
1. **Create repository**

### Step 2: Add Secret (GitHub Settings)

1. Go to **Settings** → **Secrets and variables** → **Actions**
1. **New repository secret**
- Name: `BREVO_SMTP_KEY`
- Value: `xsmtpsib-81144ac4a11005778b1856678a129c68bb4a0d8e461f074e798c2c6de22defd8-nnUGCgsAP4A8ThS9`
1. **Add secret**

### Step 3: Push Code

```bash
git clone https://github.com/abraham8a/vehicle-finder-bot.git
cd vehicle-finder-bot

# Copy these files into the folder:
# - vehicle-search.js
# - package.json
# - README.md
# - .gitignore
# - Create folder: .github/workflows/
# - Inside that folder: vehicle-search.yml

git add .
git commit -m "Initial: vehicle search bot"
git push
```

### Step 4: Test It

1. Go to repo → **Actions** tab
1. Click **Vehicle Search Bot** workflow
1. Click **Run workflow** → **Run workflow**
1. Check your email in a minute for test results

### Done! 🎉

The bot will now run automatically:

- **Every 4 hours** at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- Emails to: [support@tapminutes.app](mailto:support@tapminutes.app)
- Searches: 78550 + 60-mile radius, under $4,000

## Need Help?

**Email not arriving?**

- Check GitHub Actions logs (Actions tab → workflow run)
- Verify BREVO_SMTP_KEY secret is set
- Check spam folder

**Want to change search times?**

- Edit `.github/workflows/vehicle-search.yml`
- Change the `cron` line (see README.md for examples)

**Want to change zip code or price?**

- Edit `vehicle-search.js`
- Change CONFIG values at the top

-----

That’s it! The bot will search every 4 hours and email you directly. 🚗