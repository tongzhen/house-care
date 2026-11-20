import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));

test('Router query parsing keeps Unicode, repeated parameters and round trips', () => {
  const query = routerRequire('query-string');
  const values = { actionId: 'floor-drain', note: 'Blå dør 中文', tags: ['home', 'care'] };
  assert.deepEqual({ ...query.parse(query.stringify(values, { sort: false })) }, values);
  assert.equal(query.parse('note=hello+world').note, 'hello world');
  assert.equal(query.parse('bad=%E0%A4%A').bad, '%E0%A4%A');
});

test('malformed percent runs terminate through the actual Router decoder', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const routerRequire = createRequire(require.resolve('expo-router/package.json'));
    const query = routerRequire('query-string');
    for (const value of ['%FF'.repeat(20000), '%41%FF'.repeat(10000)]) {
      assert.equal(typeof query.parse('value=' + value).value, 'string');
    }
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('shell quoting rejects injection tokens while preserving ordinary arguments', () => {
  const { quote } = require('shell-quote');
  assert.equal(quote(['echo', 'hello world']), "echo 'hello world'");
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => quote(['echo', { comment: 'comment' }, `value${separator}id;#`]), TypeError);
  }
});

test('Metro still reads bundled PNG dimensions with the patched image parser', () => {
  const { getAssetSize } = require('metro/private/Assets');
  const path = join(process.cwd(), 'assets/housecare-icons/icon.png');
  assert.deepEqual(getAssetSize('png', readFileSync(path), path), { width: 1024, height: 1024 });
});

test('zero-length ICNS entries are rejected instead of looping', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { imageSize } = require('image-size');
    for (const length of [0, 4, 7]) {
      const input = Buffer.alloc(16);
      input.write('icns'); input.writeUInt32BE(16, 4);
      input.write('icp4', 8); input.writeUInt32BE(length, 12);
      assert.throws(() => imageSize(input), /Invalid ICNS/);
    }
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('Expo fingerprint ignore rules retain glob and negation behavior', () => {
  const root = dirname(require.resolve('@expo/fingerprint/package.json'));
  const { isIgnoredPath } = require(join(root, 'build/utils/Path.js'));
  assert.equal(isIgnoredPath('node_modules/example/index.js', ['node_modules/**']), true);
  assert.equal(isIgnoredPath('src/service.ts', ['node_modules/**']), false);
  assert.equal(isIgnoredPath('src/keep.ts', ['src/**', '!src/keep.ts']), false);
});

test('Zod rejects oversized constrained arrays before collecting element errors', () => {
  const { z } = require('zod');
  const schema = z.array(z.string()).max(10);
  assert.deepEqual(schema.parse(['home', 'care']), ['home', 'care']);
  const result = schema.safeParse(Array(10000).fill(null));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, 'too_big');
});
