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
  brevoEmail: 'support@tapminutes.app',
  brevoSmtpHost: 'smtp-relay.brevo.com',
  brevoSmtpPort: 587,
  brevoSmtpUser: 'support@tapminutes.app',
  brevoSmtpPass: process.env.BREVO_SMTP_KEY || 'xsmtpsib-81144ac4a11005778b1856678a129c68bb4a0d8e461f074e798c2c6de22defd8-nnUGCgsAP4A8ThS9',
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
    // Search for vehicles in the Rio Grande Valley area
    const craigslistUrl = `https://corpus.craigslist.org/search/cta?query=&max_price=${CONFIG.maxPrice}`;
    console.log(`Searching Craigslist: ${craigslistUrl}`);

    const html = await fetchUrl(craigslistUrl);
    
    // Parse HTML for listings (simple regex-based extraction)
    const listingRegex = /<a href="([^"]+cta[^"]+)" title="([^"]+)"/g;
    let match;

    while ((match = listingRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2];

      // Skip if it's a trap
      if (isTrap(title, '')) continue;

      // Extract price from URL or title
      const priceMatch = title.match(/\$[\d,]+/);
      const price = priceMatch ? priceMatch[0] : 'N/A';

      results.push({
        source: 'Craigslist',
        title,
        price,
        url: url.startsWith('http') ? url : `https://corpus.craigslist.org${url}`,
        description: '',
        timestamp: new Date().toISOString(),
        id: url, // Use URL as unique identifier
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

// Send email via Brevo
async function sendEmail(listings) {
  if (listings.length === 0) {
    console.log('No new listings found.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: CONFIG.brevoSmtpHost,
      port: CONFIG.brevoSmtpPort,
      secure: false,
      auth: {
        user: CONFIG.brevoSmtpUser,
        pass: CONFIG.brevoSmtpPass,
      },
    });

    const htmlContent = `
      <h2>🚗 New Vehicle Listings Found (${listings.length})</h2>
      <p>Search: 78550 area, 60-mile radius, under $${CONFIG.maxPrice}</p>
      <p>Searched at: ${new Date().toLocaleString()}</p>
      <hr>
      ${listings
        .map(
          (listing) => `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0;">${listing.title}</h3>
          <p><strong>Source:</strong> ${listing.source}</p>
          <p><strong>Price:</strong> ${listing.price}</p>
          ${listing.description ? `<p><strong>Description:</strong> ${listing.description}</p>` : ''}
          <p><a href="${listing.url}" style="background: #007bff; color: white; padding: 8px 12px; text-decoration: none; border-radius: 3px;">View Listing</a></p>
        </div>
      `
        )
        .join('')}
      <hr>
      <p style="font-size: 12px; color: #666;">Vehicle Finder Bot • Automatic search every 4 hours</p>
    `;

    const mailOptions = {
      from: CONFIG.brevoEmail,
      to: CONFIG.brevoEmail,
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

// Main function
async function main() {
  console.log(`\n[${new Date().toISOString()}] Starting vehicle search...`);
  console.log(`Search parameters: ${CONFIG.zipCode}, ${CONFIG.radiusMiles} miles, under $${CONFIG.maxPrice}`);

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
