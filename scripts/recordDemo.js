const puppeteer = require('../server/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Candidate browser executable paths on Windows
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const BROWSER_PATH = BROWSER_PATHS.find((p) => p && fs.existsSync(p));
const APP_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5002/api/health';

function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode < 500));
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Helper to verify both backend and frontend are online before launching browser
async function waitForServices(maxAttempts = 15) {
  for (let i = 1; i <= maxAttempts; i++) {
    const [backReady, frontReady] = await Promise.all([
      pingUrl(BACKEND_URL),
      pingUrl(APP_URL),
    ]);
    if (backReady && frontReady) {
      console.log('✅ Both Backend (port 5002) and Frontend (port 5173) are ready.');
      return true;
    }
    console.log(`⏳ Waiting for services: Backend=${backReady ? 'OK' : 'Waiting'}, Frontend=${frontReady ? 'OK' : 'Waiting'} (attempt ${i}/${maxAttempts})...`);
    await sleep(1500);
  }
  return false;
}

async function runDemo() {
  if (!BROWSER_PATH) {
    console.error('❌ Could not locate Google Chrome or Microsoft Edge executable.');
    process.exit(1);
  }

  console.log(`🔍 Checking QueueFlow services (Backend 5002 & Frontend 5173)...`);
  const servicesReady = await waitForServices();
  if (!servicesReady) {
    console.error(`❌ Could not connect to QueueFlow backend or frontend.`);
    console.error('👉 Please ensure dev servers are running: "npm run server" and "npm run client"');
    process.exit(1);
  }

  console.log(`🎬 Launching browser: ${BROWSER_PATH}`);

  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--disable-infobars', '--no-default-browser-check'],
    slowMo: 30,
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  // Reliable helper to click button by text using real CDP mouse clicks
  const clickButtonByText = async (text) => {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const content = await page.evaluate((el) => el.textContent, btn);
      if (content && content.includes(text)) {
        await btn.click();
        return true;
      }
    }
    return false;
  };

  // Reliable helper to click link by text using real CDP mouse clicks
  const clickLinkByText = async (text) => {
    const links = await page.$$('a');
    for (const link of links) {
      const content = await page.evaluate((el) => el.textContent, link);
      if (content && content.includes(text)) {
        await link.click();
        return true;
      }
    }
    return false;
  };

  // Helper to show stylish banner on screen explaining each step for the video
  const showBanner = async (stepText, subText = '', duration = 2400) => {
    console.log(`\n📌 [DEMO STEP] ${stepText}`);
    try {
      await page.evaluate((title, sub) => {
        let banner = document.getElementById('qf-demo-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'qf-demo-banner';
          banner.style.position = 'fixed';
          banner.style.top = '16px';
          banner.style.left = '50%';
          banner.style.transform = 'translateX(-50%)';
          banner.style.zIndex = '999999';
          banner.style.backgroundColor = '#1e1b4b';
          banner.style.color = '#ffffff';
          banner.style.padding = '12px 28px';
          banner.style.borderRadius = '16px';
          banner.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
          banner.style.border = '1px solid rgba(129, 140, 248, 0.5)';
          banner.style.fontFamily = 'Inter, system-ui, sans-serif';
          banner.style.textAlign = 'center';
          banner.style.pointerEvents = 'none';
          banner.style.transition = 'all 0.3s ease';
          document.body.appendChild(banner);
        }
        banner.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 10px #10b981;"></span>
            <strong style="font-size:14px; letter-spacing:-0.2px;">${title}</strong>
          </div>
          ${sub ? `<p style="font-size:11px; color:#c7d2fe; margin-top:3px; margin-bottom:0;">${sub}</p>` : ''}
        `;
      }, stepText, subText);
    } catch (_) {}
    await sleep(duration);
  };

  try {
    // 1. Navigate to Login Page
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Initial countdown for screen recorder
    await showBanner('QueueFlow – Smart Queue Management System', 'Full End-to-End Walkthrough Demonstration', 3000);

    // STEP 1: DEMO CREDENTIALS & LOGIN
    await showBanner('Step 1: Manager Authentication', 'Filling demo credentials: demo@queueflow.com / password123');
    await page.waitForSelector('input[type="email"]');
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', 'demo@queueflow.com', { delay: 35 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', 'password123', { delay: 35 });
    await sleep(600);

    // Click Sign In
    await showBanner('Step 1: Signing In...', 'Authenticating via secure JWT HTTP-only cookies');
    await page.click('button[type="submit"]');

    // Wait for Dashboard to mount with automatic retry if needed
    try {
      await page.waitForSelector('h1', { timeout: 12000 });
    } catch (e) {
      console.warn('⚠️ First sign-in wait exceeded, checking page status...');
      const errEl = await page.$('.bg-rose-50');
      if (errEl) {
        const msg = await page.evaluate((el) => el.innerText, errEl);
        console.warn('Login page reported error:', msg);
      }
      await sleep(1500);
      await page.click('button[type="submit"]');
      await page.waitForSelector('h1', { timeout: 15000 });
    }

    // STEP 2: DASHBOARD & 6 KPI CARDS
    await showBanner('Step 2: Operational Dashboard', 'Real-time overview with 6 live KPI cards & queue monitor');
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await sleep(2500);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

    // STEP 3: CREATE NEW QUEUE (Unique Name to avoid collision)
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newQueueName = `VIP Express Line ${randomSuffix}`;
    await showBanner('Step 3: Creating a New Queue Line', `Issuing new queue: "${newQueueName}" with prefix "VIP"`);
    await clickButtonByText('Create Queue');
    await sleep(1000);

    await page.waitForSelector('input[required]', { visible: true, timeout: 6000 });
    const nameInput = await page.$('input[placeholder*="General Consultation"]');
    if (nameInput) {
      await nameInput.click();
      await nameInput.type(newQueueName, { delay: 40 });
    } else {
      await page.type('input[required]', newQueueName, { delay: 40 });
    }
    await sleep(400);

    const prefixInput = await page.$('input[maxLength="4"]');
    if (prefixInput) {
      await prefixInput.click();
      await prefixInput.type('VIP', { delay: 50 });
    }
    await sleep(800);

    await page.evaluate(() => {
      const modalForm = document.querySelector('form');
      if (modalForm) {
        const submitBtn = modalForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });
    await sleep(2500);

    // STEP 4: GO TO MY QUEUES
    await showBanner('Step 4: Queue Management Directory', 'Navigating to My Queues with search filter');
    await clickLinkByText('My Queues');
    await sleep(2000);

    // STEP 5: OPEN QUEUE DETAILS CONSOLE
    await showBanner('Step 5: Queue Console & Token Dispatching', 'Opening Doctor Consultation queue');
    await clickLinkByText('Manage Queue');
    await sleep(2500);

    // STEP 6: ADD NEW PERSON TO QUEUE
    await showBanner('Step 6: Adding Person to Queue', 'Issuing auto-generated sequential token for Kavita Verma');
    await clickButtonByText('Add Person to Queue');
    await sleep(1200);

    await page.waitForSelector('form input', { visible: true, timeout: 5000 });
    const personNameInput = await page.$('input[placeholder*="Rahul Sharma"]');
    if (personNameInput) {
      await personNameInput.type('Kavita Verma', { delay: 45 });
    }
    const phoneInput = await page.$('input[placeholder*="+91 98765"]');
    if (phoneInput) {
      await phoneInput.type('+91 98765 11223', { delay: 45 });
    }
    await sleep(1000);

    await page.evaluate(() => {
      const modalForm = document.querySelector('form');
      if (modalForm) {
        const submitBtn = modalForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });
    await sleep(2500);

    // STEP 7: REORDERING TOKENS (MOVE UP & MOVE DOWN)
    await showBanner('Step 7: Token Reordering (Move Up / Down)', 'Swapping waiting positions atomically via DB transactions');
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await sleep(1500);

    // Click Move Up on the second waiting token (skipping disabled first token)
    await page.evaluate(() => {
      const upBtns = Array.from(document.querySelectorAll('button[title="Move Up in queue"]:not([disabled])'));
      if (upBtns.length > 0) upBtns[0].click();
    });
    await sleep(2500);

    // Click Move Down to restore order
    await page.evaluate(() => {
      const downBtns = Array.from(document.querySelectorAll('button[title="Move Down in queue"]:not([disabled])'));
      if (downBtns.length > 0) downBtns[0].click();
    });
    await sleep(2500);

    // STEP 8: CALL NEXT TOKEN FOR SERVICE
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1200);
    await showBanner('Step 8: Calling Next Person for Service', 'Summoning first waiting token into the Now Serving counter');

    await clickButtonByText('CALL NEXT TOKEN');
    await sleep(3500);

    // STEP 9: DEMONSTRATE STRICT SINGLE SERVING TOKEN RULE
    await showBanner('Step 9: Concurrency Lock & Live Timer', 'Strict single-token rule: Call Next locked while service timer is actively ticking', 3500);
    await sleep(1000);

    // STEP 10: COMPLETE SERVICE
    await showBanner('Step 10: Completing Service', 'Marking token COMPLETED and recording exact service duration metrics');
    await clickButtonByText('COMPLETE SERVICE');
    await sleep(2500);

    // STEP 11: CALL NEXT AFTER COMPLETION
    await showBanner('Step 11: Counter Ready for Next Person', 'Calling next token now that counter is free');
    await clickButtonByText('CALL NEXT TOKEN');
    await sleep(3000);

    // STEP 12: CANCEL TOKEN DEMO
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await sleep(1000);
    await showBanner('Step 12: Cancelling a Token', 'Cancelling waiting token with safety confirmation modal');

    await page.evaluate(() => {
      const cancelBtns = Array.from(document.querySelectorAll('button[title="Cancel Token"]:not([disabled])'));
      if (cancelBtns.length > 0) cancelBtns[cancelBtns.length - 1].click();
    });
    await sleep(1500);

    // Confirm cancel
    await clickButtonByText('Confirm Cancellation');
    await sleep(2200);

    // View Completed tab
    await showBanner('Step 13: Reviewing Completed & Cancelled History', 'Inspecting categorized tabs with calculated durations');
    await clickButtonByText('Completed');
    await sleep(2200);

    await clickButtonByText('Cancelled');
    await sleep(2200);

    await clickButtonByText('Waiting Queue');
    await sleep(1500);

    // STEP 14: ANALYTICS DASHBOARD WITH CHART.JS
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
    await showBanner('Step 14: Performance Analytics & Chart.js Telemetry', 'Navigating to Analytics page with genuine DB snapshots');
    await clickLinkByText('Analytics');
    await sleep(2500);

    await showBanner('Step 14: Analytics Charts', 'Line trend, status doughnut, waiting time by queue & daily throughput', 3000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(3500);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(3500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

    // STEP 15: HELP GUIDE & PROFILE
    await showBanner('Step 15: Usability & Manager Security', 'Testing Help Guide toggle and manager profile');
    await clickButtonByText('Help Guide');
    await sleep(2000);

    await clickLinkByText('Profile');
    await sleep(2500);

    await showBanner('Demonstration Complete!', 'QueueFlow: Full-Stack Smart Queue Management System', 4000);
    await sleep(3000);

    console.log('🎉 Automated Video Recording Demo Completed Successfully!');
  } catch (err) {
    console.error('Error during demo walkthrough:', err);
    try {
      console.log('Current URL:', page.url());
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Page visible text:\n', bodyText.slice(0, 500));
    } catch (_) {}
  } finally {
    // Keep browser open for a few seconds so user can stop screen recording cleanly
    await sleep(5000);
    await browser.close();
  }
}

runDemo();
