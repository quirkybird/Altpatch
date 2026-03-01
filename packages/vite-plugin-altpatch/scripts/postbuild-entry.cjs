const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');

fs.writeFileSync(
  path.join(distDir, 'index.js'),
  "export * from './vite-plugin-altpatch/src/index.js';\n",
  'utf8'
);

fs.writeFileSync(
  path.join(distDir, 'index.d.ts'),
  "export * from './vite-plugin-altpatch/src/index';\n",
  'utf8'
);
