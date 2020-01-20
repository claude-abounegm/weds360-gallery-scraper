'use strict';

const axios = require('axios').default;
const fs = require('fs-extra');

const async = require('./async');

function escapeFileName(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function generatePngFileName(title, id) {
    let name = escapeFileName(title);
    if (id) {
        name = `${name}_${id}`;
    }
    name = `${name}.png`;

    return name;
}

async function downloadAndSaveImage(url, opts) {
    const { title, categoryId, imageId } = opts;

    const imgName = generatePngFileName(title, imageId);

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

module.exports = { escapeFileName, generatePngFileName, downloadAndSaveImage };
