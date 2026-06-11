#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Configuration
const CONFIG = {
  zipCode: '78550',
  radiusMiles: 60,
  maxPrice: 4000,
  checkInterval: 4 * 60 * 60 * 1000, // 4 hours
  sentListingsFile: path.join(__dirname, 'sent-listings.json'),
  gmailSmtpHost: 'smtp.gmail.com',
  gmailSmtpPort: 587,
  gmailSmtpUser: 'abaham8a@gmail.com',
  gmailSmtpPass: process.env.GMAIL_APP_PASSWORD,
  toEmail: 'abaham8a@gmail.com',
};

// Load previously sent listings
function loadSentListings() {
  try {
    if (fs.existsSync(CONFIG.sentListingsFile)) {
      const data = fs.readFileSync(CONFIG.sentListingsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading sent listings:', err);
  }
  return {};
}

// Save sent listings
function saveSentListings(listings) {
  try {
    // In GitHub Actions, we can't persist state between runs easily
    // So we'll just log it instead of saving to file
    if (process.env.GITHUB_ACTIONS) {
      console.log('GitHub Actions detected - listing tracking not persisted');
      return;
    }
    fs.writeFileSync(CONFIG.sentListingsFile, JSON.stringify(listings, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving sent listings:', err);
  }
}

// Check for financing trap keywords
function isTrap(title, description) {
  const trapKeywords = [
    'owner financing',
    'we finance',
    'bad credit',
    'no credit check',
    'lease to own',
    'down payment',
    'financing available',
    'payment plan',
  ];
  const text = `${title} ${description}`.toLowerCase();
  return trapKeywords.some(keyword => text.includes(keyword));
}

// Fetch from URL with promise
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

// Search Craigslist
async function searchCraigslist() {
  const results = [];
  try {
    // Search for vehicles in the Rio Grande Valley area (Corpus Christi)
    const craigslistUrl = `https://corpus.craigslist.org/search/cta?query=&max_price=${CONFIG.maxPrice}&sort=rel`;
    console.log(`Searching Craigslist: ${craigslistUrl}`);

    const html = await fetchUrl(craigslistUrl);
    
    // Parse HTML for actual vehicle listing posts with price and description
    const listingRegex = /<a[^>]*href="([^"]*\/[0-9]{10,}\.html)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>[\s\S]*?<span class="result-price">\$?([\d,]+)<\/span>/g;
    let match;

    while ((match = listingRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();
      const price = match[3].replace(/,/g, '');

      // Skip if it's a trap
      if (isTrap(title, '')) continue;

      results.push({
        source: 'Craigslist',
        title,
        price: `$${price}`,
        url: url.startsWith('http') ? url : `https://corpus.craigslist.org${url}`,
        description: `Corpus Christi area • ${price} miles from 78550`,
        timestamp: new Date().toISOString(),
        id: url,
      });
    }
  } catch (err) {
    console.error('Craigslist search error:', err.message);
  }
  return results;
}

// Search Facebook Marketplace (via public listings)
async function searchFacebook() {
  const results = [];
  try {
    // Facebook Marketplace doesn't have a direct API, but we can search for patterns
    console.log('Searching Facebook Marketplace...');
    // Note: Full Facebook scraping requires authentication. This is a placeholder.
    // For production, consider using a third-party service or API.
  } catch (err) {
    console.error('Facebook search error:', err.message);
  }
  return results;
}

// Search Autotrader
async function searchAutotrader() {
  const results = [];
  try {
    // Autotrader search for Corpus Christi area
    const autotraderUrl = `https://www.autotrader.com/cars-for-sale/searchresults.xhtml?zip=78550&distance=60&maxPrice=${CONFIG.maxPrice}&startYear=2000`;
    console.log(`Searching Autotrader: ${autotraderUrl}`);

    const html = await fetchUrl(autotraderUrl);

    // Parse HTML for vehicle listings
    const carRegex = /<a[^>]*href="([^"]*cars-for-sale[^"]*)"[^>]*>\s*<[^>]*>([^<]+)/g;
    let match;

    while ((match = carRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      if (isTrap(title, '')) continue;

      results.push({
        source: 'Autotrader',
        title,
        price: 'Check listing',
        url: url.startsWith('http') ? url : `https://www.autotrader.com${url}`,
        description: '',
        timestamp: new Date().toISOString(),
        id: url,
      });
    }
  } catch (err) {
    console.error('Autotrader search error:', err.message);
  }
  return results;
}

// Search CarGurus
async function searchCargurus() {
  const results = [];
  try {
    // CarGurus search
    const cargurusUrl = `https://www.cargurus.com/Cars/t-Used_cars_for_under_${CONFIG.maxPrice}_in_78550.html`;
    console.log(`Searching CarGurus: ${cargurusUrl}`);

    const html = await fetchUrl(cargurusUrl);

    // Parse for listings
    const listingRegex = /<a[^>]*href="([^"]*cargurus[^"]*)"[^>]*>([^<]+)/g;
    let match;

    while ((match = listingRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      if (isTrap(title, '')) continue;

      results.push({
        source: 'CarGurus',
        title,
        price: 'Check listing',
        url: url.startsWith('http') ? url : `https://www.cargurus.com${url}`,
        description: '',
        timestamp: new Date().toISOString(),
        id: url,
      });
    }
  } catch (err) {
    console.error('CarGurus search error:', err.message);
  }
  return results;
}

// Send email via Gmail
async function sendEmail(listings) {
  if (listings.length === 0) {
    console.log('No new listings found.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: CONFIG.gmailSmtpHost,
      port: CONFIG.gmailSmtpPort,
      secure: false,
      auth: {
        user: CONFIG.gmailSmtpUser,
        pass: CONFIG.gmailSmtpPass,
      },
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #d32f2f; border-bottom: 3px solid #d32f2f; padding-bottom: 10px;">🚗 ${listings.length} New Vehicle Listing(s) Found</h1>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Search Area:</strong> 78550 (Los Fresnos) • 60-mile radius</p>
          <p><strong>Price Range:</strong> Under $${CONFIG.maxPrice}</p>
          <p><strong>Searched:</strong> ${new Date().toLocaleString()}</p>
        </div>

        ${listings
          .map(
            (listing, index) => `
          <div style="border: 2px solid #e0e0e0; padding: 20px; margin: 20px 0; border-radius: 8px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <h2 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">${index + 1}. ${listing.title}</h2>
                <p style="margin: 5px 0; color: #d32f2f; font-size: 20px; font-weight: bold;">${listing.price}</p>
              </div>
              <span style="background: #007bff; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;">${listing.source}</span>
            </div>
            
            ${listing.description ? `<p style="margin: 10px 0; color: #666;">${listing.description}</p>` : ''}
            
            <a href="${listing.url}" style="display: inline-block; background: #28a745; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px; font-weight: bold;">View Full Listing →</a>
          </div>
        `
          )
          .join('')}

        <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #999;">
          <p>Vehicle Finder Bot • Automatically searches every 4 hours</p>
          <p>Search parameters: 78550 area, 60-mile radius, under $${CONFIG.maxPrice}</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: CONFIG.gmailSmtpUser,
      to: CONFIG.toEmail,
      subject: `🚗 ${listings.length} New Vehicle Listing(s) Found - ${new Date().toLocaleDateString()}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    console.log(`Recipients: ${listings.length} new listings`);
  } catch (err) {
    console.error('Error sending email:', err);
  }
}

// Test email configuration
async function testEmail() {
  console.log('\n📧 Testing email configuration...');
  try {
    const transporter = nodemailer.createTransport({
      host: CONFIG.gmailSmtpHost,
      port: CONFIG.gmailSmtpPort,
      secure: false,
      auth: {
        user: CONFIG.gmailSmtpUser,
        pass: CONFIG.gmailSmtpPass,
      },
    });

    await transporter.verify();
    console.log('✅ Email configuration is valid!');
    return true;
  } catch (err) {
    console.error('❌ Email configuration failed:', err.message);
    return false;
  }
}

// Main function
async function main() {
  console.log(`\n[${new Date().toISOString()}] Starting vehicle search...`);
  console.log(`Search parameters: ${CONFIG.zipCode}, ${CONFIG.radiusMiles} miles, under $${CONFIG.maxPrice}`);
  
  // Test email first
  const emailValid = await testEmail();

  const sentListings = loadSentListings();
  let allListings = [];

  // Search all sources
  const [craigslistResults, facebookResults, autotraderResults, cargurusResults] = await Promise.all([
    searchCraigslist(),
    searchFacebook(),
    searchAutotrader(),
    searchCargurus(),
  ]);

  allListings = [...craigslistResults, ...facebookResults, ...autotraderResults, ...cargurusResults];

  // Filter out already sent listings
  const newListings = allListings.filter((listing) => {
    if (sentListings[listing.id]) {
      console.log(`Skipping already sent: ${listing.title}`);
      return false;
    }
    return true;
  });

  console.log(`\nResults: ${allListings.length} total, ${newListings.length} new`);

  // Mark listings as sent and save
  newListings.forEach((listing) => {
    sentListings[listing.id] = {
      title: listing.title,
      sentAt: new Date().toISOString(),
      source: listing.source,
    };
  });
  saveSentListings(sentListings);

  // Send email if there are new listings
  if (newListings.length > 0) {
    await sendEmail(newListings);
  }

  console.log(`[${new Date().toISOString()}] Search complete.\n`);
}

// Run immediately and then every 4 hours
main().catch(console.error);

// Uncomment for continuous mode (every 4 hours):
// setInterval(main, CONFIG.checkInterval);
