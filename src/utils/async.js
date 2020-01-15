'use strict';

const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const util = require('util');
const async = require('async');

/**
 * Recursively gets all files in directories
 *
 * @param {string | { root: string; maxDepth: number; }} opts
 * @param {{ basePath: string; filePath: string; fileName: string; }} [cb]
 *
 * @returns {{ basePath: string; filePath: string; fileName: string; }[]|void}
 */
async function getFiles(opts, cb) {
    if (_.isFunction(cb)) {
        return _getFiles(opts, cb);
    }

    const files = [];
    await _getFiles(opts, async data => files.push(data));
    return files;
}

async function _getFiles(opts, cb, depth = 0) {
    let basePath,
        maxDepth = false;

    if (_.isString(opts)) {
        basePath = opts;
    } else if (_.isPlainObject(opts)) {
        basePath = opts.root;
        maxDepth = opts.maxDepth;
    }

    const files = await fs.readdir(basePath);

    for (const fileName of files) {
        const filePath = path.join(basePath, fileName);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
            if (maxDepth === false || depth < maxDepth) {
                await _getFiles(filePath, cb, depth + 1);
            }
        } else {
            await cb({
                basePath,
                filePath,
                fileName
            });
        }
    }
}

module.exports = {
    getFiles,
    // map: util.promisify((arr, iterator) => async.mapLimit(arr, 1, iterator))
    map: util.promisify(async.map),
    mapLimit: util.promisify(async.mapLimit),
    retry: util.promisify(async.retry)
};
