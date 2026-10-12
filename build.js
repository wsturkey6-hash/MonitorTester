// Inline core.js into index.html -> dist/MonitorTester.html (single shareable file).
// Usage: node build.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const TAG = '<script src="core.js"></script>';

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');

if (html.split(TAG).length !== 2) {
  throw new Error('index.html must contain exactly one ' + TAG);
}
// Keep an embedded "</script" from closing the inline tag early.
const safeCore = core.replace(/<\/script/gi, '<\\/script');

const out = html.replace(TAG, () => '<script>\n' + safeCore + '\n</script>');
const outPath = path.join(root, 'dist', 'MonitorTester.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log('wrote ' + path.relative(root, outPath) + ' (' + out.length + ' chars)');
