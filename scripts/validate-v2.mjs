// Validates feed-v2.json against docs/unified-content-contract.md. Plain Node, no dependencies.
//
//   node scripts/validate-v2.mjs                     check feed-v2.json
//   node scripts/validate-v2.mjs --base origin/main  also check updatedAt and revisions against that git ref
//   node scripts/validate-v2.mjs --bare <file|dir>   check bundled release-note files (<version>.json)
//
// Exit code 1 on any error. Warnings are printed but never fail the run.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const FEED = 'feed-v2.json';
const LOCALES = ['en-GB', 'nl-NL', 'de-DE', 'fr-FR'];
const TYPES = ['release', 'upcoming', '2ba', 'etim', 'general'];
const RELEASE_TYPES = ['release', 'upcoming'];
const MAX_REVISION = Number.MAX_SAFE_INTEGER;
const TIMESTAMP = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const ICON = /^ph-[a-z0-9-]+$/;
const KIND_ORDER = ['action', 'new', 'fixed', 'integrators'];
const KINDS = {
	action: {release: true, fields: ['items'], check: (s, at) => need(s, 'items', at)},
	new: {release: true, fields: ['groups'], check: (s, at) => need(s, 'groups', at)},
	fixed: {release: true, fields: ['items', 'groups'], check: (s, at) => {
		if (('items' in s) === ('groups' in s)) error(at, 'needs exactly one of items or groups');
	}},
	integrators: {release: true, fields: ['text', 'table'], check: (s, at) => { need(s, 'text', at); need(s, 'table', at); }},
	general: {release: false, fields: ['text', 'items'], check: (s, at) => {
		if (!('text' in s) && !('items' in s)) error(at, 'needs text and/or items');
	}},
};

const errors = [];
const warnings = [];
const error = (at, msg) => errors.push(`${at}: ${msg}`);
const warn = (at, msg) => warnings.push(`${at}: ${msg}`);
const isObject = (v) => null !== v && 'object' === typeof v && !Array.isArray(v);
const isString = (v) => 'string' === typeof v;
const nonEmpty = (v) => isString(v) && '' !== v.trim();
const need = (o, key, at) => { if (!(key in o)) error(at, `missing ${key}`); };

function allowOnly(o, keys, at) {
	for (const key of Object.keys(o)) if (!keys.includes(key)) error(at, `unknown field "${key}"`);
}

// JSON.parse silently keeps the last of two equal member names, so the raw text is
// scanned first. This tokenizer only tracks object keys; JSON.parse checks the rest.
function findDuplicateKeys(text) {
	const found = [];
	const stack = [];
	let i = 0;
	const readString = () => {
		const start = i++;
		while (i < text.length && '"' !== text[i]) i += '\\' === text[i] ? 2 : 1;
		try {
			return JSON.parse(text.slice(start, ++i));
		} catch {
			return text.slice(start, i); // an invalid string; JSON.parse in readJson reports it
		}
	};
	while (i < text.length) {
		const c = text[i];
		if ('"' === c) {
			const value = readString();
			const top = stack[stack.length - 1];
			if (top && top.object && top.expectKey) {
				let j = i;
				while (/\s/.test(text[j] ?? '')) j++;
				if (':' === text[j]) {
					if (top.keys.has(value)) found.push(value);
					top.keys.add(value);
					top.expectKey = false;
				}
			}
			continue;
		}
		if ('{' === c) stack.push({object: true, keys: new Set(), expectKey: true});
		else if ('[' === c) stack.push({object: false});
		else if ('}' === c || ']' === c) stack.pop();
		else if (',' === c) { const top = stack[stack.length - 1]; if (top?.object) top.expectKey = true; }
		i++;
	}
	return found;
}

function readJson(file, text) {
	const duplicates = findDuplicateKeys(text);
	if (duplicates.length) error(file, `duplicate member names: ${[...new Set(duplicates)].join(', ')}`);
	try {
		return JSON.parse(text);
	} catch (e) {
		error(file, `not valid JSON: ${e.message}`);
		return undefined;
	}
}

function isCalendarDate(y, m, d) {
	const date = new Date(Date.UTC(+y, +m - 1, +d));
	return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d;
}

function timestamp(value, at) {
	const m = isString(value) ? TIMESTAMP.exec(value) : null;
	if (!m || !isCalendarDate(m[1], m[2], m[3]) || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) {
		error(at, `"${value}" is not a timestamp like 2026-10-12T10:00:00Z`);
		return null;
	}
	return Date.parse(value);
}

// ---------------------------------------------------------------- text and markup

const CODE_SPAN = /`[^`]+`/g;

// Control, zero-width and bidi characters can make text read differently than it is
const HIDDEN_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

function inlineText(value, at) {
	if (HIDDEN_CHARS.test(value)) error(at, 'control, zero-width or bidi characters are not allowed');
	const outside = value.replace(CODE_SPAN, '');
	if (/<\/?[a-zA-Z!]/.test(outside)) error(at, 'HTML is not allowed');
	if (outside.includes('](')) error(at, 'links are not allowed; use the item url field');
}

function plainText(value, at) {
	inlineText(value, at);
	if (/[`*]/.test(value)) warn(at, 'plain-text field contains ` or *, which is shown as typed');
}

function item(value, at) {
	if (isString(value)) {
		if ('' === value.trim()) error(at, 'empty item');
		else inlineText(value, at);
		return;
	}
	if (!isObject(value)) return error(at, 'an item is a string or {title, text}');
	allowOnly(value, ['title', 'text'], at);
	if (!isString(value.title) || !isString(value.text)) return error(at, 'item needs string title and text');
	if ('' === value.title.trim() && '' === value.text.trim()) error(at, 'item title and text are both empty');
	inlineText(value.title, at + '.title');
	inlineText(value.text, at + '.text');
}

function nonEmptyArray(value, at) {
	if (!Array.isArray(value) || 0 === value.length) { error(at, 'must be a non-empty array'); return false; }
	return true;
}

function textField(value, at) {
	if (!nonEmpty(value)) return error(at, 'must be a non-empty string');
	inlineText(value, at);
}

function section(s, at, release) {
	if (!isObject(s)) return error(at, 'a section is an object');
	const kind = Object.hasOwn(KINDS, s.kind) ? KINDS[s.kind] : undefined;
	if (!kind) return error(at, `unknown kind "${s.kind}"`);
	if (kind.release !== release) error(at, `kind "${s.kind}" is not allowed in ${release ? 'release items' : 'other announcements'}`);
	allowOnly(s, ['kind', 'heading', ...kind.fields], at);
	if (!nonEmpty(s.heading)) error(at, 'heading must be a non-empty string');
	else plainText(s.heading, at + '.heading');
	kind.check(s, at);
	if ('text' in s) textField(s.text, at + '.text');
	if ('items' in s && nonEmptyArray(s.items, at + '.items')) s.items.forEach((v, i) => item(v, `${at}.items[${i}]`));
	if ('groups' in s && nonEmptyArray(s.groups, at + '.groups')) {
		s.groups.forEach((g, i) => {
			const gat = `${at}.groups[${i}]`;
			if (!isObject(g)) return error(gat, 'a group is an object');
			allowOnly(g, ['title', 'text', 'items'], gat);
			if (!isString(g.title)) error(gat, 'group needs a string title');
			else plainText(g.title, gat + '.title');
			if (!('text' in g) && !('items' in g)) error(gat, 'group needs text and/or items');
			if ('text' in g) textField(g.text, gat + '.text');
			if ('items' in g && nonEmptyArray(g.items, gat + '.items')) g.items.forEach((v, j) => item(v, `${gat}.items[${j}]`));
		});
	}
	if ('table' in s) {
		const t = s.table;
		const tat = at + '.table';
		if (!isObject(t)) return error(tat, 'a table is an object');
		allowOnly(t, ['columns', 'rows'], tat);
		if (nonEmptyArray(t.columns, tat + '.columns')) t.columns.forEach((c, i) => isString(c) ? plainText(c, `${tat}.columns[${i}]`) : error(`${tat}.columns[${i}]`, 'must be a string'));
		if (nonEmptyArray(t.rows, tat + '.rows')) {
			t.rows.forEach((row, i) => {
				const rat = `${tat}.rows[${i}]`;
				if (!Array.isArray(row)) return error(rat, 'a row is an array');
				if (Array.isArray(t.columns) && row.length !== t.columns.length) error(rat, `has ${row.length} cells, columns has ${t.columns.length}`);
				row.forEach((cell, j) => isString(cell) ? inlineText(cell, `${rat}[${j}]`) : error(`${rat}[${j}]`, 'must be a string'));
			});
		}
	}
}

// The shape every translation must share with en-GB
const outline = (texts) => (Array.isArray(texts?.sections) ? texts.sections : []).map((s) => [
	s?.kind,
	Array.isArray(s?.items) ? s.items.length : 0,
	Array.isArray(s?.groups) ? s.groups.map((g) => (Array.isArray(g?.items) ? g.items.length : 0)) : [],
	Array.isArray(s?.table?.columns) ? s.table.columns.length : 0,
	Array.isArray(s?.table?.rows) ? s.table.rows.length : 0,
]);

function locales(map, at, release) {
	if (!isObject(map)) return error(at, 'must be an object of locales');
	for (const locale of LOCALES) if (!(locale in map)) error(at, `missing locale ${locale}`);
	for (const [locale, texts] of Object.entries(map)) {
		const lat = `${at}.${locale}`;
		if (!isObject(texts)) { error(lat, 'must be {title, intro, sections}'); continue; }
		allowOnly(texts, ['title', 'intro', 'sections'], lat);
		if (!nonEmpty(texts.title)) error(lat, 'title must be a non-empty string');
		else plainText(texts.title, lat + '.title');
		if (!isString(texts.intro)) error(lat, 'intro must be a string');
		else inlineText(texts.intro, lat + '.intro');
		if (!Array.isArray(texts.sections)) { error(lat, 'sections must be an array'); continue; }
		texts.sections.forEach((s, i) => section(s, `${lat}.sections[${i}]`, release));
		if (release && 'en-GB' === locale) {
			const order = texts.sections.map((s) => KIND_ORDER.indexOf(s?.kind));
			if (order.some((v, i) => i > 0 && v <= order[i - 1])) warn(lat, 'release sections should be in the order action, new, fixed, integrators, each at most once');
		}
	}
	if (isObject(map['en-GB'])) {
		const english = JSON.stringify(outline(map['en-GB']));
		for (const [locale, texts] of Object.entries(map)) {
			if (isObject(texts) && JSON.stringify(outline(texts)) !== english) error(`${at}.${locale}`, 'sections, groups, items, columns or rows differ from en-GB');
		}
	}
}

// A bundled file, or an item's releaseNotes. type is null for a bare file.
function releaseNotes(rn, at, type) {
	if (!isObject(rn)) return error(at, 'must be an object');
	allowOnly(rn, ['version', 'status', 'released_on', 'icon', 'locales'], at);
	if (!isString(rn.version) || !VERSION.test(rn.version)) error(at, `version "${rn.version}" is not like 2.3.0`);
	if (!['upcoming', 'released'].includes(rn.status)) error(at, 'status must be upcoming or released');
	if (null !== type && (('release' === type) !== ('released' === rn.status))) error(at, `type "${type}" does not match status "${rn.status}"`);
	if ('released' === rn.status) {
		const m = isString(rn.released_on) ? DATE.exec(rn.released_on) : null;
		if (!m || !isCalendarDate(m[1], m[2], m[3])) error(at, 'a released release needs released_on as a real YYYY-MM-DD date');
	} else if ('released_on' in rn) {
		warn(at, 'released_on on an upcoming release is ignored');
	}
	if ('icon' in rn && (!isString(rn.icon) || !ICON.test(rn.icon))) error(at, `icon "${rn.icon}" is not a Phosphor class like ph-sparkle`);
	locales(rn.locales, at + '.locales', true);
}

// ---------------------------------------------------------------- revisions

// Locale key order is content (it decides the same-language fallback); other key order is formatting.
function canonical(value, keepOrder = false) {
	if (Array.isArray(value)) return value.map((v) => canonical(v));
	if (!isObject(value)) return value;
	const keys = keepOrder ? Object.keys(value) : Object.keys(value).sort();
	return keys.map((k) => [k, canonical(value[k], 'locales' === k)]);
}

function content(item) {
	const rn = isObject(item.releaseNotes) ? item.releaseNotes : {};
	return JSON.stringify(canonical({
		type: item.type,
		priority: item.priority ?? 'normal',
		url: item.url ?? null,
		status: rn.status ?? null,
		released_on: 'released' === rn.status ? (rn.released_on ?? null) : null,
		icon: rn.icon ?? null,
		locales: item.locales ?? rn.locales ?? null,
	}));
}

function compareWithBase(feed, ref) {
	const git = (...args) => execFileSync('git', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
	try {
		git('rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`);
	} catch {
		return error(FEED, `cannot read the comparison ref ${ref}; fetch it first`);
	}
	let text = null;
	let exists = true;
	try {
		git('cat-file', '-e', '--end-of-options', `${ref}:${FEED}`);
	} catch {
		exists = false;
	}
	if (exists) {
		text = git('show', '--end-of-options', `${ref}:${FEED}`);
	} else {
		// Only a valid commit without the file is a first publication
		console.log(`No ${FEED} on ${ref}: every item counts as new`);
	}
	let base = null;
	if (null !== text) {
		try {
			base = JSON.parse(text);
		} catch (e) {
			return error(FEED, `${FEED} on ${ref} is not valid JSON: ${e.message}`);
		}
	}
	const baseItems = new Map((base?.announcements ?? []).map((item) => [item.id, item]));
	const changed = null === base || JSON.stringify(canonical(base)) !== JSON.stringify(canonical(feed));

	if (base && changed && !(Date.parse(feed.updatedAt) > Date.parse(base.updatedAt))) {
		error(FEED, `updatedAt must be later than ${base.updatedAt} on ${ref} when the feed changes`);
	}
	for (const item of feed.announcements) {
		if (!isObject(item) || !isString(item.id)) continue;
		const before = baseItems.get(item.id);
		const at = `item ${item.id}`;
		if (!before) {
			if (1 !== item.revision) error(at, 'a new item starts at revision 1');
			continue;
		}
		if (item.revision < before.revision) error(at, `revision went down from ${before.revision} to ${item.revision}`);
		else if (content(item) !== content(before) && !(item.revision > before.revision)) {
			error(at, `content changed, so revision must be greater than ${before.revision}`);
		}
		if (before.releaseNotes?.version !== item.releaseNotes?.version) error(at, 'version must never change');
	}
}

// ---------------------------------------------------------------- feed

function validateFeed(ref) {
	const feed = readJson(FEED, fs.readFileSync(FEED, 'utf8'));
	if (!isObject(feed)) return error(FEED, 'must be a JSON object');
	allowOnly(feed, ['schemaVersion', 'updatedAt', 'announcements'], FEED);
	if (2 !== feed.schemaVersion) error(FEED, 'schemaVersion must be 2');
	const updated = timestamp(feed.updatedAt, FEED + ' updatedAt');
	if (null !== updated && updated > Date.now() + 24 * 3600 * 1000) error(FEED, 'updatedAt is more than 24 hours in the future');
	if (!Array.isArray(feed.announcements)) return error(FEED, 'announcements must be an array');

	const ids = new Set();
	const versions = new Set();
	feed.announcements.forEach((item, index) => {
		const at = `item ${isObject(item) && isString(item.id) ? item.id : '#' + index}`;
		if (!isObject(item)) return error(at, 'must be an object');
		const release = RELEASE_TYPES.includes(item.type);
		allowOnly(item, ['id', 'type', 'publishedAt', 'revision', 'releaseNotes', 'locales', 'priority', 'url', 'expiresAt'], at);
		if (!nonEmpty(item.id)) error(at, 'id must be a non-empty string');
		else if (ids.has(item.id)) error(at, 'duplicate id');
		ids.add(item.id);
		if (!TYPES.includes(item.type)) error(at, `unknown type "${item.type}"`);
		const published = timestamp(item.publishedAt, at + ' publishedAt');
		if (!Number.isInteger(item.revision) || item.revision < 1 || item.revision > MAX_REVISION) error(at, 'revision must be an integer from 1');
		if ('priority' in item && !['normal', 'important'].includes(item.priority)) error(at, 'priority must be normal or important');
		if ('url' in item) {
			if (!isString(item.url)) error(at, 'url must be a string');
			else try { if ('https:' !== new URL(item.url).protocol) error(at, 'url must be HTTPS'); } catch { error(at, 'url is not a URL'); }
		}
		if ('expiresAt' in item) {
			const expires = timestamp(item.expiresAt, at + ' expiresAt');
			if (null !== expires && null !== published && expires <= published) error(at, 'expiresAt must be later than publishedAt');
		}
		if (release) {
			if ('locales' in item) error(at, 'a release item has releaseNotes, not locales');
			if (!('releaseNotes' in item)) return error(at, 'a release item needs releaseNotes');
			releaseNotes(item.releaseNotes, at + ' releaseNotes', item.type);
			const version = item.releaseNotes?.version;
			if (isString(version)) {
				if (item.id !== `release-${version}`) error(at, `id must be release-${version}`);
				if (versions.has(version)) error(at, `duplicate version ${version}`);
				versions.add(version);
			}
		} else if (TYPES.includes(item.type)) {
			if ('releaseNotes' in item) error(at, 'only release items have releaseNotes');
			if (!('locales' in item)) return error(at, 'needs locales');
			locales(item.locales, at + ' locales', false);
		}
	});

	if (ref && 0 === errors.length) compareWithBase(feed, ref);
	return feed.announcements.length;
}

// ---------------------------------------------------------------- bare files

function validateBare(target) {
	if (!fs.existsSync(target)) {
		error(target, 'no such file or directory');
		return 0;
	}
	const files = fs.statSync(target).isDirectory()
		? fs.readdirSync(target).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(target, f))
		: [target];
	for (const file of files) {
		const rn = readJson(file, fs.readFileSync(file, 'utf8'));
		if (undefined === rn) continue;
		releaseNotes(rn, file, null);
		if (isObject(rn) && path.basename(file) !== `${rn.version}.json`) error(file, `file name must be ${rn.version}.json`);
	}
	return files.length;
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
// Anything but one --base <ref> or one --bare <path> would quietly skip a check
for (let i = 0; i < args.length; i += 2) {
	if (!['--base', '--bare'].includes(args[i])) {
		console.error(`error: unknown argument ${args[i]}; use --base <ref> or --bare <path>`);
		process.exit(1);
	}
	if (args.indexOf(args[i]) !== i) {
		console.error(`error: ${args[i]} given more than once`);
		process.exit(1);
	}
}
if (args.includes('--base') && args.includes('--bare')) {
	console.error('error: use --base or --bare, not both');
	process.exit(1);
}
const option = (name) => {
	const i = args.indexOf(name);
	if (-1 === i) return null;
	const value = args[i + 1];
	// A missing value must never quietly skip a check
	if (undefined === value || '' === value || value.startsWith('--')) {
		console.error(`error: ${name} needs a value`);
		process.exit(1);
	}
	return value;
};
const bare = option('--bare');
const count = null !== bare ? validateBare(bare) : validateFeed(option('--base'));

for (const w of warnings) console.warn('warning: ' + w);
if (errors.length) {
	for (const e of errors) console.error('error: ' + e);
	console.error(`${errors.length} error(s)`);
	process.exit(1);
}
console.log(null !== bare ? `Validated ${count} release-note file(s)` : `Validated ${count} announcements in ${FEED}`);
