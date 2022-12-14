var fs = require('fs');
var path = require('path');
var http = require('http');
var ecstatic = require('ecstatic');
var open = require('open');
var browserify = require('browserify');
var minimist = require('minimist');

var constants = require('../../tasks/util/constants');
var makeWatchifiedBundle = require('../../tasks/util/watchified_bundle');
var shortcutPaths = require('../../tasks/util/shortcut_paths');

var args = minimist(process.argv.slice(2), {});
var PORT = args.port || 3000;
var strict = args.strict;
var mathjax3 = args.mathjax3;
var mathjax3chtml = args.mathjax3chtml;

// Create server
var server = http.createServer(ecstatic({
    root: constants.pathToRoot,
    cache: 0,
    gzip: true,
    cors: true
}));

// Make watchified bundle for plotly.js
var bundlePlotly = makeWatchifiedBundle(strict, function() {
    // open up browser window on first bundle callback
    open('http://localhost:' + PORT + '/devtools/test_dashboard/index' + (
        strict ? '-strict' :
        mathjax3 ? '-mathjax3' :
        mathjax3chtml ? '-mathjax3chtml' : ''
    ) + '.html');
});

// Bundle devtools code
var devtoolsPath = path.join(constants.pathToRoot, 'devtools/test_dashboard');
var devtools = browserify(path.join(devtoolsPath, 'devtools.js'), {
    transform: [shortcutPaths]
});

// Start the server up!
server.listen(PORT);

// Build and bundle all the things!
getMockFiles()
    .then(readFiles)
    .then(createMocksList)
    .then(saveToFile)
    .then(bundleDevtools)
    .then(bundlePlotly);


function getMockFiles() {
    return new Promise(function(resolve, reject) {
        fs.readdir(constants.pathToTestImageMocks, function(err, files) {
            if(err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

function readFiles(files) {
    var promises = files.map(function(file) {
        var filePath = path.join(constants.pathToTestImageMocks, file);
        return readFilePromise(filePath);
    });

    return Promise.all(promises);
}

function createMocksList(files) {
    // eliminate pollutants (e.g .DS_Store) that can accumulate in the mock directory
    var jsonFiles = files.filter(function(file) {
        return file.name.substr(-5) === '.json';
    });

    var mocksList = jsonFiles.map(function(file) {
        var contents = JSON.parse(file.contents);

        // get plot type keywords from mocks
        var types = contents.data.map(function(trace) {
            return trace.type || 'scatter';
        }).reduce(function(acc, type, i, arr) {
            if(arr.lastIndexOf(type) === i) {
                acc.push(type);
            }
            return acc;
        }, []);

        var filename = file.name.split(path.sep).pop();

        return {
            name: filename.slice(0, -5),
            file: filename,
            keywords: types.join(', ')
        };
    });

    return mocksList;
}

function saveToFile(mocksList) {
    var filePath = path.join(constants.pathToBuild, 'test_dashboard_mocks.json');
    var content = JSON.stringify(mocksList, null, 4);

    return writeFilePromise(filePath, content);
}

function readFilePromise(file) {
    return new Promise(function(resolve, reject) {
        fs.readFile(file, { encoding: 'utf-8' }, function(err, contents) {
            if(err) {
                reject(err);
            } else {
                resolve({
                    name: file,
                    contents: contents
                });
            }
        });
    });
}

function writeFilePromise(path, contents) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(path, contents, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve(path);
            }
        });
    });
}

function bundleDevtools() {
    return new Promise(function(resolve, reject) {
        devtools.bundle(function(err) {
            if(err) {
                console.error('Error while bundling!', JSON.stringify(String(err)));
                return reject(err);
            } else {
                return resolve();
            }
        }).pipe(fs.createWriteStream(constants.pathToTestDashboardBundle));
    });
}
