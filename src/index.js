'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const { async, puppeteer } = require('./utils');
const {
    getGalleryCategories,
    getImagesFromPageByCategory
} = require('./scraper');

async function main() {
    const browser = await puppeteer.newBrowser();

    async function newPage(url) {
        return puppeteer.newPage(browser, url);
    }

    try {
        const categories = await getGalleryCategories({ newPage });
        const images = await async.map(
            categories,
            async ({ id: categoryId }) => {
                return await getImagesFromPageByCategory({
                    categoryId,
                    startPageNumber: 1,
                    newPage
                });
            }
        );

        const basePath = './output';
        await fs.mkdirp(basePath).catch(_.noop);
        await fs.writeFile(
            `${basePath}/db.json`,
            JSON.stringify({ categories, images: _.flatten(images) })
        );
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
