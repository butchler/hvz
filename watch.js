// Use browserify/watchify and babeljs to automatically compile ES6 to ES5.
// When source code changes, automatically restart game server running in
// headless browser using phantomjs, and automatically reload page using
// livereload.

var fs = require('fs');
var child_process = require('child_process');

var browserify = require('browserify');
var watchify = require('watchify');
var livereload = require('livereload');

var babel = require('babel-core');
var chokidar = require('chokidar');

// Automatically recompile and restart the web server.
var webServer = undefined;
watchBabel('src/web-server.js', 'dist/web-server.js', function () {
    // Restart nodejs web server.
    if (webServer !== undefined)
        webServer.kill();

    webServer = child_process.spawn('node', ['dist/web-server.js']);

    console.log('Restarted web server.');
});

// Automatically compile the client and game server code.
watchBrowserify('src/game-server.js', 'dist/game-server/game-server.js');
watchBrowserify('src/client.js', 'dist/client/client.js');

// Start a livereload server to automatically refresh the client when
// client.js is updated. Listens on port 35729 by default.
var livereloadServer = livereload.createServer();
// Also reload when the game server changes.
livereloadServer.watch(['dist/client', 'dist/game-server']);
console.log('Started livereload server.');

// Bundles fromFile to toFile using watchify, and calls onUpdate when the
// bundle is updated.
function watchBrowserify(fromFile, toFile, onUpdate) {
    var bundler = browserify({
        entries: [fromFile],
        paths: ['src'],
        cache: {}, packageCache: {}, // Needed for watchify
        plugin: [watchify]
    });

    // When files are updated, write the bundle to a file and call optional
    // callback.
    var update = function () {
        var bundle = bundler.bundle();
        bundle.pipe(fs.createWriteStream(toFile));

        console.log(`Bundling "${fromFile}"...`);

        // Display compile errors.
        bundle.on('error', function (error) {
            console.error(`Error bundling ${fromFile}:`);
            console.error(error.stack || String(error));
        });

        // Display success message when finished bundling.
        bundle.on('end', function () {
            console.log(`Wrote bundle of "${fromFile}" to "${toFile}".`);

            // Call optional callback if bundling succeeds.
            if (onUpdate !== undefined)
                onUpdate();
        });
    };

    bundler.on('update', update);

    // Bundle all of the files when watch.js is first run.
    update();
}

// Watch for changes to an ES6 file using chokidar and compile to ES5 it using babeljs.
function watchBabel(fromFile, toFile, onUpdate) {
    chokidar.watch(fromFile).on("all", function (type, filename) {
        if (type === "add" || type === "change") {
            console.log(`Compiling ${fromFile}...`);

            babel.transformFile(fromFile, function (error, result) {
                if (error) {
                    console.error(`Error compiling ${fromFile}: ${error}`);
                } else {
                    fs.writeFileSync(toFile, result.code);

                    console.log(`Compiled ${fromFile} to ${toFile}`);

                    if (onUpdate !== undefined)
                        onUpdate();
                }
            });
        }
    });
}
