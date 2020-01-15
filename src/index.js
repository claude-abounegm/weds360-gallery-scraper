'use strict';

const _ = require('lodash');
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const axios = require('axios').default;
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

function escapeFileName(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

async function downloadAndSaveImage(url, opts) {
    const imgName = `${escapeFileName(opts.title)}.png`;

    const imgDirPath = `/category/${opts.categoryId}`;
    const imgFilePath = `${imgDirPath}/${imgName}`;

    const localDirPath = `output/${imgDirPath}`;
    const localFilePath = `output/${imgFilePath}`;

    console.log('Downloading image:', imgName);

    const { data: imgBuffer } = await axios.get(url, {
        responseType: 'arraybuffer'
    });
    await fs.mkdirp(localDirPath).catch(_.noop);
    await fs.writeFile(localFilePath, imgBuffer);

    console.log('Saved image:', imgName);

    return {
        imgName,
        imgDirPath,
        imgFilePath,
        localDirPath,
        localFilePath
    };
}

async function main() {
    const browser = await newBrowser();

    async function newPage() {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 900 });
        return page;
    }

    async function getImagesFromPage({ page, selector, transformFn }) {
        const thumbnailContainers = await page.$$(
            `div.${selector}--container > div > div`
        );

        const data = await async.map(thumbnailContainers, async container => {
            const imgUrl = await container.$eval('img', el => el.src.trim());
            const href = await container.$eval('a', el => el.href.trim());
            const title = await container.$eval('h3', el =>
                el.textContent.trim()
            );

            let data = {
                img: imgUrl,
                href,
                title
            };

            if (_.isFunction(transformFn)) {
                data = await transformFn(data);
            }

            return data;
        });

        return data;
    }

    async function getImagesFromPageByCategory(
        categoryId,
        startPageNumber = 1
    ) {
        const page = await newPage();
        await goTo(
            page,
            `https://weds360.com/en/photos?category=${categoryId}&page=${startPageNumber}`
        );

        const allImages = [];
        let done = false;
        let pageNumber = startPageNumber;

        while (!done) {
            console.log();
            console.log('Processing page', pageNumber);

            const images = await getImagesFromPage({
                page,
                selector: 'photos',
                transformFn: async data => {
                    const { title } = data;
                    console.log('Image with title:', title);

                    return data;
                }
            });

            for (const image of images) {
                allImages.push({ _id: allImages.length, ...image });
            }

            if (await page.$('.next.next_page.disabled a')) {
                done = true;
            } else {
                await clickAndWait(page, '.next.next_page a');
            }

            ++pageNumber;
        }

        await page.close();

        return async.mapLimit(allImages, 5, async image => {
            const { _id, title, img: imgUrl } = image;

            const { imgFilePath } = await downloadAndSaveImage(imgUrl, {
                title,
                categoryId
            });

            return { _id, title, img: imgFilePath };
        });
    }

    async function getGalleryCategories() {
        const page = await newPage();
        await goTo(
            page,
            'https://weds360.com/en/categories?parent_menu=photos'
        );

        const images = await getImagesFromPage({
            page,
            selector: 'vendors',
            transformFn: async data => {
                const { href, img: imgUrl, title } = data;
                const categoryId = +/category=(\d+)/.exec(href)[1];

                console.log('CategoryId', categoryId, ':', title);

                const { imgFilePath } = await downloadAndSaveImage(imgUrl, {
                    title,
                    categoryId
                });

                return {
                    _id: categoryId,
                    title,
                    img: imgFilePath
                };
            }
        });

        await page.close();

        return images;
    }

    try {
        const categories = await async.map(
            await getGalleryCategories(),
            async category => {
                const { _id: categoryId } = category;

                const images = await getImagesFromPageByCategory(categoryId);

                return {
                    ...category,
                    images
                };
            }
        );

        await fs.writeFile('output/db.json', JSON.stringify({ categories }));
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
