'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs-extra');

async function getImagesFromPage(page) {
    const thumbnailContainers = await page.$$(
        'div.photos--wrapper > div.photos--container > div > div'
    );

    const data = [];
    for (const container of thumbnailContainers) {
        const img = await container.$eval('img', el => el.src);
        const title = await container.$eval('h3', el => el.textContent);

        data.push({
            img,
            title
        });
    }

    return data;
}

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        devtools: false,
        ignoreHTTPSErrors: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 900 });

        function goTo(url, options) {
            return page.goto(url, {
                waitUntil: 'domcontentloaded',
                ...options
            });
        }

        function clickAndWait(selector) {
            return Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                page.click(selector)
            ]);
        }

        await goTo('https://weds360.com/en/photos?category=4');

        const combined = [];
        let done = false;
        while (!done) {
            const data = await getImagesFromPage(page);
            combined.push(...data);

            if (await page.$('.next.next_page.disabled a')) {
                done = true;
            } else {
                await clickAndWait('.next.next_page a');
            }
        }

        await fs.writeFile('db.json', JSON.stringify(combined));
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
