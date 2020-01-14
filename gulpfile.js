'use strict';

const gulp = require('gulp');
const tap = require('gulp-tap');
const prettier = require('gulp-prettier');

function pretty() {
    return gulp
        .src(['**/*.js', '!**/node_modules/**', '!**/public/**'])
        .pipe(
            tap(file => {
                console.log(`prettify: ${file.path}`);
            })
        )
        .pipe(prettier({ config: '.prettierrc.json' }))
        .pipe(gulp.dest('.'));
}

// Export tasks
exports.pretty = pretty;
