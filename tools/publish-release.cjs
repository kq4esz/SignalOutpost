const fs = require('node:fs');
const path = require('node:path');

const owner = 'kq4esz';
const repo = 'SignalOutpost';
const token = process.env.GITHUB_TOKEN;
const tag = process.env.RELEASE_TAG;
const version = `v${require('../package.json').version}`;
const apiRoot = `https://api.github.com/repos/${owner}/${repo}`;

if (!token) throw new Error('GITHUB_TOKEN is required to publish the release.');
if (!tag || tag !== version) throw new Error(`RELEASE_TAG must match the package version (${version}).`);

async function request(method, url, body, headers = {}) {
	const jsonBody = body != null && !Buffer.isBuffer(body);
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
			...headers,
		},
		...(body != null ? { body: jsonBody ? JSON.stringify(body) : body } : {}),
	});
	if (!response.ok) {
		const detail = await response.text();
		throw new Error(`GitHub ${method} ${new URL(url).pathname} returned ${response.status}: ${detail.slice(0, 500)}`);
	}
	return response.status === 204 ? null : response.json();
}

function releaseFiles() {
	const output = path.resolve('release');
	const firmware = path.resolve('assets/firmware/current');
	const files = fs.readdirSync(output, { withFileTypes: true })
		.filter((entry) => entry.isFile() && (
			entry.name === 'latest.yml' ||
			/^Signal-Outpost-CPS-.*-Setup\.exe(?:\.blockmap)?$/.test(entry.name)
		))
		.map((entry) => path.join(output, entry.name));
	if (!files.some((file) => file.endsWith('.exe')) || !files.some((file) => path.basename(file) === 'latest.yml')) {
		throw new Error('The release directory must contain the Windows installer and latest.yml.');
	}
	files.push(...fs.readdirSync(firmware, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.join(firmware, entry.name)));
	return files;
}

function releaseAssetLabel(file) {
	if (!file.toLowerCase().endsWith('.bin')) return '';
	const directory = path.dirname(file);
	for (const name of fs.readdirSync(directory).filter((entry) => entry.toLowerCase().endsWith('.json'))) {
		try {
			const manifest = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
			if (manifest.format === 'rfoundry-release/1' && manifest.image?.file === path.basename(file)) {
				return manifest.display_name || `Signal Outpost ${manifest.board_name || manifest.board} ${manifest.version || ''}`.trim();
			}
		} catch { /* not a release manifest */ }
	}
	return '';
}

async function main() {
	const body = fs.readFileSync('release-notes.md', 'utf8');
	const metadata = { name: `Signal Outpost CPS ${tag}`, body, draft: false, prerelease: false };
	let release;
	const lookup = await fetch(`${apiRoot}/releases/tags/${encodeURIComponent(tag)}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
	});
	if (lookup.status === 404) {
		release = await request('POST', `${apiRoot}/releases`, { tag_name: tag, target_commitish: process.env.GITHUB_SHA || 'main', ...metadata });
	} else if (lookup.ok) {
		release = await lookup.json();
		release = await request('PATCH', `${apiRoot}/releases/${release.id}`, metadata);
	} else {
		throw new Error(`GitHub release lookup returned ${lookup.status}.`);
	}

	const existing = await request('GET', `${apiRoot}/releases/${release.id}/assets?per_page=100`);
	const byName = new Map(existing.map((asset) => [asset.name, asset]));
	for (const file of releaseFiles()) {
		const name = path.basename(file);
		const old = byName.get(name);
		if (old) await request('DELETE', `${apiRoot}/releases/assets/${old.id}`);
		const label = releaseAssetLabel(file);
		const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}${label ? `&label=${encodeURIComponent(label)}` : ''}`;
		const payload = fs.readFileSync(file);
		const asset = await request('POST', uploadUrl, payload, { 'Content-Type': 'application/octet-stream' });
		console.log(`Uploaded ${asset.name} (${asset.size} bytes).`);
	}
	console.log(`Published ${tag}: ${release.html_url}`);
}

main().catch((error) => {
	console.error(error.message || String(error));
	process.exitCode = 1;
});
