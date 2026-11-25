const fs = require('node:fs');

const tag = process.argv[2];
if (!tag) throw new Error('Usage: node tools/release-notes.cjs v1.0.0');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^## ${escapedTag}(?:\\s|$)`, 'm');
const match = heading.exec(changelog);
if (!match) throw new Error(`No CHANGELOG.md entry was found for ${tag}`);

const start = match.index;
const next = /^## /gm;
next.lastIndex = start + match[0].length;
const endMatch = next.exec(changelog);
const body = changelog.slice(start, endMatch ? endMatch.index : undefined).trim();
fs.writeFileSync('release-notes.md', `${body}\n`, 'utf8');
