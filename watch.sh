#!/bin/sh

# Automatically bundle code when files change.
watchify src/index.js -o bundle.js -d -v &

# Start livereload server, accessed by script in index.html.
livereload . -p 8001 -d &

# Start local HTTP server.
python -m http.server
