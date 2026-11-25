const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve('assets/firmware/current');
const sumsPath = path.join(directory, 'SHA256SUMS.txt');
const manifestPath = fs.readdirSync(directory)
  .filter((name) => name.toLowerCase().endsWith('.json'))
  .map((name) => path.join(directory, name))
  .find((file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')).format === 'rfoundry-release/1'; }
    catch { return false; }
  });
if (!manifestPath) throw new Error('No RadioFoundry release manifest was found.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.format !== 'rfoundry-release/1' || manifest.board !== 'dm32') {
  throw new Error('Firmware manifest is not a RadioFoundry DM-32UV release manifest.');
}
const imagePath = path.join(directory, manifest.image.file);
const image = fs.readFileSync(imagePath);
const imageSha = crypto.createHash('sha256').update(image).digest('hex');
if (image.length !== manifest.image.size || imageSha !== manifest.image.sha256) {
  throw new Error('Firmware image size or SHA-256 does not match its manifest.');
}

const sums = fs.readFileSync(sumsPath, 'utf8');
const listed = new Map(sums.split(/\r?\n/).filter(Boolean).map((line) => {
  const [digest, name] = line.trim().split(/\s+/, 2);
  return [name.replace(/^\*?/, ''), digest.toLowerCase()];
}));
if (listed.get(manifest.image.file) !== imageSha) {
  throw new Error('SHA256SUMS.txt does not match the firmware image.');
}

for (const [name, digest] of listed) {
  const file = fs.readFileSync(path.join(directory, name));
  const actual = crypto.createHash('sha256').update(file).digest('hex');
  if (actual !== digest) throw new Error(`Checksum mismatch: ${name}`);
}

console.log(`${manifest.version} verified (${image.length} bytes, SHA-256 ${imageSha}).`);
