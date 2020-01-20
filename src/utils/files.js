'use strict';

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

module.exports = { escapeFileName, generatePngFileName };
