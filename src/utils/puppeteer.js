const puppeteer = require('puppeteer');

async function newBrowser() {
    return puppeteer.launch({
        headless: true,
        devtools: false,
        ignoreHTTPSErrors: true,
        args: ['--no-sandbox']
    });
}

function goTo(page, url, options) {
    return page.goto(url, {
        waitUntil: 'domcontentloaded',
        ...options
    });
}

function clickAndWait(page, selector) {
    return Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click(selector)
    ]);
}

async function newPage(browser, url) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });

    if (url) {
        await goTo(page, url);
    }

    return page;
}

module.exports = { newBrowser, goTo, clickAndWait, newPage };
