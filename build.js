import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

console.log('📦 Building static site for GitHub Pages...');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Recursively copy public to dist
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursiveSync(srcDir, distDir);

// Add .nojekyll so GitHub Pages doesn't ignore files starting with underscores
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

console.log('✅ Static build complete! Output written to dist/');
