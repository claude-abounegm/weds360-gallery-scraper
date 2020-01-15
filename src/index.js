'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const { async } = require('./utils');

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

async function getImagesFromPage(page) {
    const thumbnailContainers = await page.$$(
        'div.photos--wrapper > div.photos--container > div > div'
    );

    const data = await async.map(thumbnailContainers, async container => {
        const img = await container.$eval('img', el => el.src.trim());
        const title = await container.$eval('h3', el => el.textContent.trim());

        console.log('Image with title:', title);

        return {
            img,
            title
        };
    });

    return data;
}

async function getImagesFromPageByCategory(page, categoryId) {
    await goTo(page, `https://weds360.com/en/photos?category=${categoryId}`);

    const combined = [];
    let done = false;
    let pageNumber = 1;

    while (!done) {
        console.log();
        console.log('Processing page', pageNumber);

        const data = await getImagesFromPage(page);
        combined.push(...data);

        if (await page.$('.next.next_page.disabled a')) {
            done = true;
        } else {
            await clickAndWait(page, '.next.next_page a');
        }

        ++pageNumber;
    }

    return combined;
}

async function main() {
    const browser = await newBrowser();

    async function newPage() {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 900 });
        return page;
    }

    try {
        const combined = await getImagesFromPageByCategory(await newPage(), 4);

        await fs.writeFile('output/db.json', JSON.stringify(combined));
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
