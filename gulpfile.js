const gulp = require('gulp');
const del = require('del');
const path = require('path');
const browserify = require('gulp-browserify');
const closure = require('gulp-closure-compiler');
const concat = require('gulp-concat');
const env = require('gulp-env');
const inline = require('gulp-inline-ng2-template');
const pug = require('gulp-pug');
const source = require('gulp-sourcemaps');
const util = require('gulp-util');
const tsc = require('gulp-typescript');
const sequence = require('run-sequence');
const each = require('gulp-foreach');

const project = emitHelpers => tsc.createProject('tsconfig.json', {noEmitHelpers: !emitHelpers});

// Methods for quick access to project directories' paths
const routes = {
    const folderObject = folder => {
        file: file => path.join(folder, file),
        all: type => path.join(folder, '**/*.' + type),
        dir: folder
    };

    return {
        full: __dirname,
        app: folderObject(path.join(__dirname, 'app')),
        prebuild: folderObject(path.join(__dirname, 'prebuild')),
        build: folderObject(path.join(__diname, 'build')), 
        vendor: folderObject(path.join(__dirname, 'vendor'))
    };
}

// Cleans the `prebuild` directory preparing it to new prebuild
gulp.task('prepare', () => {
    del([
        routes.prebuild.file('*'),
        '!' + routes.prebuild.file('.gitignore')
    ]);
});

// Processes `pug` files
gulp.task('pug', ['prepare'], () => {
    return gulp.src(routes.app.all('pug'))
        .pipe(pug())
        .pipe(gulp.dest(routes.app.dir));
});

gulp.task('sass', ['prepare'], () => {
    var files = gulp.src(routes.app.all('scss'));

    if (process.env.DEV) {
        files = files.pipe(source.init())
            .pipe(sass())
        .pipe(source.write());
    } else {
        files = files.pipe(sass({output: 'compressed'}))   
    }

    return files.pipe(gulp.dest(file => file.base));
});

gulp.task('tsc', ['pug', 'sass'], () => {
    const currentProject = project(process.env.DEV);

    var files = currentProject.src();
        
    if (process.env.DEV) {
        files = files.pipe(source.init())
            .pipe(tsc(currentProject))
        .pipe(source.write());
    } else {
        files = files.pipe(tsc(currentProject));
    }

    return files.pipe(gulp.dest(routes.full));
});

gulp.task('inline', ['tsc'], () => {
    const config = currentPath => {
        base: path.relative(routes.full, path.dirname(currentPath)),
        target: 'es5',
        indent: 0
    };

    return gulp.src(routes.app.all('js'))
        .pipe(each((stream, file) => stream
            .pipe(inline(config(file.path)))
            .pipe(gulp.dest(routes.app.dir))
        ));
});

gulp.task('move-js', ['inline'], () => {
    if (process.env.DEV) {
        gulp.src(routes.app.all('js.map'))
            .pipe(gulp.dest(routes.prebuild.dir));
    }

    return gulp.src(routes.app.all('js'))
        .pipe(gulp.dest(routes.prebuild.dir));
});

gulp.task('clean', ['move-js'], () => {
    del([
        routes.app.all('html'),
        routes.app.all('js'),
        routes.app.all('js.map')
    ]);
});

gulp.task('browserify', ['move-js'], () => {
    return gulp.src(path.join(routes.prebuild.file('app.js')))
		.pipe(browserify({
            insertGlobals: false,
            debug: process.env.DEV
		}))
		.pipe(gulp.dest(routes.build.dir));
});

gulp.task('concat', ['browserify'], () => {
    return gulp.src([routes.build.all('js'), routes.vendor.all('js')])
        .pipe(concat('app.js'))
        .pipe(gulp.dest(routes.build.dir));
});

gulp.task('minify', ['concat'], () => {
    return gulp.src(routes.build.all('js'))
        .pipe(closure({
            compilerPath: routes.vendor.file('compiler.jar'),
            fileName: 'app.min.js',
            tieredCompilation: true,
            continueWithWarnings: true,
            compilerFlags: {
                language_in: 'ECMASCRIPT5_STRICT',
            }
        }))
        .pipe(gulp.dest(routes.build.dir));
});

// Sets developer environment
gulp.task('env-dev', () => {
    env({
        vars: {
            DEV: true
        }
    });
});

// Sets production environment:
// - No sourcemaps for scss and ts files
// - Compressed html & css
gulp.task('env-prod', () => {
    env({
        vars: {
            DEV: false
        }
    });
});

// Runs developer environment
gulp.task('run', ['env-dev', 'browserify']);

// Runs production environment
gulp.task('run-prod', ['env-prod', 'minify']);

// Watches changes of all files
gulp.task('watch', () => {
    const run = 'run';

    gulp.watch(routes.app.all('scss'), [run]);
    gulp.watch(routes.app.all('pug'), [run]);
    gulp.watch(routes.app.all('ts'), [run]);
});
