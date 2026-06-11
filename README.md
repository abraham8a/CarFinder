# Vehicle Finder Bot 🚗

Automated vehicle search bot that searches multiple sources every 4 hours and emails you new listings under $4,000 in the 78550 area (60-mile radius).

## Features

✅ **Multi-source search**:

- Craigslist
- Autotrader
- CarGurus
- Facebook Marketplace (extensible)

✅ **Automatic filtering**:

- Removes financing/down payment trap listings
- Prevents duplicate emails
- Price under $4,000
- 60-mile radius from 78550

✅ **Email notifications**:

- Full listing details with links
- Via Brevo SMTP ([support@tapminutes.app](mailto:support@tapminutes.app))
- Immediate upon finding new listings

✅ **GitHub-hosted**:

- Runs automatically every 4 hours via GitHub Actions
- No server needed
- Simple JSON-based tracking

## Setup

### 1. Create the Repository

```bash
# Create new repo on GitHub
# Name: vehicle-finder-bot
# Owner: abraham8a
# Public or Private (doesn't matter)
```

### 2. Add GitHub Secret

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
1. Click **New repository secret**
1. Name: `BREVO_SMTP_KEY`
1. Value: `xsmtpsib-81144ac4a11005778b1856678a129c68bb4a0d8e461f074e798c2c6de22defd8-nnUGCgsAP4A8ThS9`
1. Click **Add secret**

### 3. Push to GitHub

```bash
git clone https://github.com/abraham8a/vehicle-finder-bot.git
cd vehicle-finder-bot

# Copy the files from this setup into the repo:
# - vehicle-search.js
# - package.json
# - .github/workflows/vehicle-search.yml
# - .gitignore (optional)

git add .
git commit -m "Initial commit: vehicle search bot"
git push origin main
```

### 4. Enable GitHub Actions

1. Go to repo → **Actions** tab
1. Confirm workflows are enabled
1. The bot will run automatically every 4 hours (UTC)

### 5. Manual Testing

Click **Actions** → **Vehicle Search Bot** → **Run workflow** → **Run workflow**

This will execute immediately and send a test email.

## How It Works

### Schedule

- **Every 4 hours** at: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- Adjust in `.github/workflows/vehicle-search.yml` under `cron` if needed

### Search Process

1. Queries Craigslist, Autotrader, CarGurus for vehicles under $4,000
1. Filters out financing traps (keywords like “owner financing”, “bad credit”, etc.)
1. Checks against `sent-listings.json` to avoid duplicates
1. Sends email to [support@tapminutes.app](mailto:support@tapminutes.app) with new listings
1. Updates `sent-listings.json` and commits to repo

### Email Format

- Subject: `🚗 X New Vehicle Listing(s) Found - [Date]`
- HTML formatted with clickable links to each listing
- Full title, price, source, and direct URL

## Customization

### Change Search Parameters

Edit `vehicle-search.js`:

```javascript
const CONFIG = {
  zipCode: '78550',        // Change zip code
  radiusMiles: 60,         // Change radius
  maxPrice: 4000,          // Change max price
  brevoEmail: 'support@tapminutes.app', // Change email
};
```

### Add More Search Sources

Add a new function in `vehicle-search.js`:

```javascript
async function searchYourSource() {
  const results = [];
  // Fetch and parse listings
  return results;
}
```

Then add it to the `Promise.all()` in `main()`:

```javascript
const [craigslistResults, facebookResults, autotraderResults, cargurusResults, yourSourceResults] = await Promise.all([
  searchCraigslist(),
  searchFacebook(),
  searchAutotrader(),
  searchCargurus(),
  searchYourSource(),
]);

allListings = [...craigslistResults, ...facebookResults, ...autotraderResults, ...cargurusResults, ...yourSourceResults];
```

### Change Notification Frequency

Edit `.github/workflows/vehicle-search.yml`:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
    # - cron: '0 * * * *'  # Every 1 hour
    # - cron: '0 12 * * *' # Daily at noon UTC
```

## Troubleshooting

### Bot isn’t sending emails

1. Check **Actions** tab → workflow logs
1. Verify `BREVO_SMTP_KEY` secret is set correctly
1. Check that [support@tapminutes.app](mailto:support@tapminutes.app) can receive email from Brevo

### No listings found

- Listings may already have been sent
- Try the manual trigger to test
- Check that prices match the $4,000 limit
- Verify zip code and radius are correct

### GitHub Actions timing

- Cron times are in **UTC**, not your local timezone
- Add 6 hours if you’re in Central Time (UTC-6)
- Adjust the cron expression as needed

## Files

- `vehicle-search.js` - Main search script
- `package.json` - Node dependencies
- `.github/workflows/vehicle-search.yml` - GitHub Actions workflow
- `sent-listings.json` - Tracking file (auto-created)

## License

MIT

-----

**Questions?** Check the GitHub Actions logs or adjust the script as needed. Happy hunting! 🏎️