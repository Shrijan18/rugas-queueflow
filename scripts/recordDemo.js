const puppeteer = require('../server/node_modules/puppeteer-core');
const path = require('path');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function runDemo() {
  console.log('🎬 Launching Chrome for QueueFlow Video Recording Demo...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
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
  const showBanner = async (stepText, subText = '', duration = 2200) => {
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
    await showBanner('QueueFlow – Smart Queue Management System', 'Starting demonstration... screen recording active', 3000);

    // STEP 1: DEMO CREDENTIALS & LOGIN
    await showBanner('Step 1: Manager Authentication', 'Filling demo credentials: demo@queueflow.com / password123');
    await page.waitForSelector('input[type="email"]');
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', 'demo@queueflow.com', { delay: 40 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', 'password123', { delay: 40 });
    await sleep(600);

    // Click Sign In
    await showBanner('Step 1: Signing In...', 'Authenticating via secure JWT HTTP-only cookies');
    await page.click('button[type="submit"]');
    await sleep(2500);

    // Wait for Dashboard to mount
    await page.waitForSelector('h1', { timeout: 8000 });

    // STEP 2: DASHBOARD & 6 KPI CARDS
    await showBanner('Step 2: Operational Dashboard', 'Real-time overview with 6 KPI cards & active queues');
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await sleep(2500);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

    // STEP 3: CREATE NEW QUEUE
    await showBanner('Step 3: Creating a New Queue Line', 'Opening Create Queue modal and issuing custom prefix');
    await clickButtonByText('Create Queue');
    await sleep(1000);

    await page.waitForSelector('input[required]', { visible: true, timeout: 6000 });
    await page.type('input[required]', 'VIP Express Counter', { delay: 60 });
    await sleep(500);

    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length > 1) {
        inputs[1].value = 'VIP';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(1000);

    await page.evaluate(() => {
      const modalForm = document.querySelector('form');
      if (modalForm) {
        const submitBtn = modalForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });
    await sleep(2200);

    // STEP 4: GO TO MY QUEUES
    await showBanner('Step 4: Queue Management Directory', 'Navigating to My Queues with search filter');
    await clickLinkByText('My Queues');
    await sleep(2000);

    // STEP 5: OPEN QUEUE DETAILS CONSOLE
    await showBanner('Step 5: Queue Console & Token Dispatching', 'Opening Doctor Consultation queue');
    await clickLinkByText('Manage Queue');
    await sleep(2500);

    // STEP 6: ADD NEW PERSON TO QUEUE
    await showBanner('Step 6: Adding Person to Queue', 'Issuing auto-generated sequential token');
    await clickButtonByText('Add Person to Queue');
    await sleep(1200);

    await page.waitForSelector('form input', { visible: true, timeout: 5000 });
    const modalInputs = await page.$$('form input');
    if (modalInputs.length > 0) {
      await modalInputs[0].type('Kavita Verma', { delay: 60 });
    }
    if (modalInputs.length > 1) {
      await modalInputs[1].type('+91 98765 11223', { delay: 50 });
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

    // Click Move Up on the second token
    await page.evaluate(() => {
      const upBtns = Array.from(document.querySelectorAll('button[title*="Move Up in queue"]'));
      if (upBtns.length > 0) upBtns[0].click();
    });
    await sleep(2200);

    // Click Move Down to restore order
    await page.evaluate(() => {
      const downBtns = Array.from(document.querySelectorAll('button[title*="Move Down in queue"]'));
      if (downBtns.length > 0) downBtns[0].click();
    });
    await sleep(2200);

    // STEP 8: CALL NEXT TOKEN FOR SERVICE
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1200);
    await showBanner('Step 8: Calling Next Person for Service', 'Summoning first waiting token into the Now Serving counter');

    await clickButtonByText('CALL NEXT TOKEN');
    await sleep(3500);

    // STEP 9: DEMONSTRATE STRICT SINGLE SERVING TOKEN RULE
    await showBanner('Step 9: Concurrency Protection', 'Only ONE token can be served at a time; live elapsed timer actively ticking', 3500);
    await sleep(1000);

    // STEP 10: COMPLETE SERVICE
    await showBanner('Step 10: Completing Service', 'Marking token COMPLETED and recording service duration metrics');
    await clickButtonByText('COMPLETE SERVICE');
    await sleep(2500);

    // STEP 11: CALL NEXT AFTER COMPLETION
    await showBanner('Step 11: Counter Ready for Next Person', 'Calling next token now that counter is free');
    await clickButtonByText('CALL NEXT TOKEN');
    await sleep(3000);

    // STEP 12: CANCEL TOKEN DEMO
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await sleep(1000);
    await showBanner('Step 12: Cancelling a Token', 'Cancelling token with safety confirmation modal');

    await page.evaluate(() => {
      const cancelBtns = Array.from(document.querySelectorAll('button[title*="Cancel Token"]'));
      if (cancelBtns.length > 0) cancelBtns[cancelBtns.length - 1].click();
    });
    await sleep(1500);

    // Confirm cancel
    await clickButtonByText('Confirm Cancellation');
    await sleep(2200);

    // View Completed tab
    await showBanner('Step 13: Reviewing Completed & Cancelled History', 'Inspecting categorized tabs');
    await clickButtonByText('Completed');
    await sleep(2200);

    await clickButtonByText('Cancelled');
    await sleep(2200);

    // STEP 14: ANALYTICS DASHBOARD WITH CHART.JS
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
    await showBanner('Step 14: Performance Analytics & Chart.js Telemetry', 'Navigating to Analytics page');
    await clickLinkByText('Analytics');
    await sleep(2500);

    await showBanner('Step 14: Analytics Charts', 'Line trend, status doughnut, waiting time by queue & daily throughput', 3000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(3500);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(3500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

    // STEP 15: MANAGER PROFILE & LOGOUT
    await showBanner('Step 15: Manager Profile & Security', 'Reviewing manager credentials and secure session protocols');
    await clickLinkByText('Profile');
    await sleep(3000);

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
