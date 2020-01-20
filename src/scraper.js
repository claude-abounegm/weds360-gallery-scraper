'use strict';

const _ = require('lodash');

const { async, puppeteer, files } = require('./utils');

async function getImagesFromPage({ page, selector, transformFn }) {
    const thumbnailContainers = await page.$$(
        `div.${selector}--container > div > div`
    );

    const data = await async.map(thumbnailContainers, async container => {
        const imgUrl = await container.$eval('img', el => el.src.trim());
        const href = await container.$eval('a', el => el.href.trim());
        const title = await container.$eval('h3', el => el.textContent.trim());

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
    startPageNumber = 1,
    newPage
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
                const imageDetails = await async.retry(3, async () => {
                    return await getImageDetails({ imageId, newPage });
                });
                console.log('Done fetching image details', imageId);

                return {
                    id: imageId,
                    img,
                    title,
                    ...imageDetails
                };
            }
        });

        allImages.push(...images);

        if (await page.$('.next.next_page.disabled a')) {
            done = true;
        } else {
            await puppeteer.clickAndWait(page, '.next.next_page a');
            ++pageNumber;
        }
    }

    await page.close();

    return async.mapLimit(allImages, 10, async image => {
        const { id, title, img: imgUrl } = image;

        const { imgFilePath } = await files.downloadAndSaveImage(imgUrl, {
            title,
            categoryId,
            imageId: id
        });
        // const imgFilePath = imgUrl;

        return { categoryId, ...image, img: imgFilePath };
    });
}

async function getGalleryCategories({ newPage }) {
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

            const { imgFilePath } = await files.downloadAndSaveImage(imgUrl, {
                title,
                categoryId
            });

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

async function getImageDetails({ imageId, newPage }) {
    const page = await newPage(`https://weds360.com/en/photos/${imageId}`);

    try {
        const photoDescription = await page.$('.photo--description');

        const { textContent: title } = await photoDescription.$('h2');
        const { textContent: description } = await photoDescription.$('h5');
        const { href, name } = await photoDescription.$('h5 a');

        return { id: imageId, title, description, service: { href, name } };
    } finally {
        await page.close();
    }
}

module.exports = {
    getImageDetails,
    getGalleryCategories,
    getImagesFromPageByCategory,
    getImagesFromPage
};
