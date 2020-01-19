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

function generateFileName(title, id) {
    let name = escapeFileName(title);
    if (id) {
        name = `${name}_${id}`;
    }
    name = `${name}.png`;

    return name;
}

async function downloadAndSaveImage(url, opts) {
    const { title, categoryId, imageId } = opts;

    const imgName = generateFileName(title, imageId);

    const imgDirPath = `/category/${categoryId}`;
    const imgFilePath = `${imgDirPath}/${imgName}`;

    const localDirPath = `output/${imgDirPath}`;
    const localFilePath = `output/${imgFilePath}`;

    console.log('Downloading image:', imgName);

    const imgBuffer = await async.retry(3, async () => {
        const { data: imgBuffer } = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        return imgBuffer;
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

    async function newPage(url) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 900 });

        if (url) {
            await goTo(page, url);
        }

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

    async function getImagesFromPageByCategory({
        categoryId,
        startPageNumber = 1
    }) {
        const page = await newPage(
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
                    const { href, img, title } = data;
                    const imageId = +/photos\/(\d+)/.exec(href)[1];

                    console.log('ImageId:', imageId, 'with title:', title);

                    return { id: imageId, img, title };
                }
            });

            allImages.push(...images);

            if (await page.$('.next.next_page.disabled a')) {
                done = true;
            } else {
                await clickAndWait(page, '.next.next_page a');
                ++pageNumber;
            }
        }

        await page.close();

        return async.mapLimit(allImages, 10, async image => {
            const { id, title, img: imgUrl } = image;

            const { imgFilePath } = await downloadAndSaveImage(imgUrl, {
                title,
                categoryId,
                imageId: id
            });
            // const imgFilePath = imgUrl;

            return { categoryId, ...image, img: imgFilePath };
        });
    }

    async function getGalleryCategories() {
        const page = await newPage(
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
                // const imgFilePath = imgUrl;

                return {
                    id: categoryId,
                    title,
                    img: imgFilePath
                };
            }
        });

        await page.close();

        return images;
    }

    async function getImageDetails(imageId) {
        const page = await newPage(`https://weds360.com/en/photos/${imageId}`);

        try {
            const photoDescription = await page.$('.photo--description');
            const title = await photoDescription.$eval('h2', el =>
                el.textContent.trim()
            );
            const description = await photoDescription.$eval('h5', el =>
                el.textContent.trim()
            );

            const service = await photoDescription.$eval('h5 a', el => ({
                href: el.href.trim(),
                name: el.textContent.trim()
            }));

            return { id: imageId, title, description, service };
        } finally {
            await page.close();
        }
    }

    try {
        const categories = await getGalleryCategories();
        const images = await async.map(
            categories,
            async ({ id: categoryId }) => {
                let images = await getImagesFromPageByCategory({
                    categoryId,
                    startPageNumber: 1
                });

                images = await async.map(images, async image => {
                    const imageDetails = await getImageDetails(image.id);

                    return {
                        ...image,
                        ...imageDetails
                    };
                });

                return images;
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
