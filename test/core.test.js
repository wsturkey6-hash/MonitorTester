const test = require('node:test');
const assert = require('node:assert');
const MT = require('../core.js');

const px = (buf, w, x, y) => [buf[(y * w + x) * 3], buf[(y * w + x) * 3 + 1], buf[(y * w + x) * 3 + 2]];
const ids = Object.keys(MT.PATTERNS);
const ramp = (i, n) => (n <= 1 ? 0 : Math.round(i * 1023 / (n - 1)));

test('pattern registry order and ids', () => {
  assert.deepStrictEqual(ids, ['hgray', 'vgray', 'steps', 'border', 'solid', 'bars', 'checker', 'rgbramp']);
  assert.strictEqual(MT.MAX_W, 7680);
  assert.strictEqual(MT.MAX_H, 4320);
});

test('every pattern renders at 1x1 and normal sizes, values in 0..1023 integers', () => {
  for (const id of ids) {
    for (const [w, h] of [[1, 1], [1, 7], [9, 1], [64, 48], [101, 37]]) {
      const b = MT.renderPattern(id, w, h, {});
      assert.ok(b instanceof Uint16Array);
      assert.strictEqual(b.length, w * h * 3);
      for (const v of b) assert.ok(Number.isInteger(v) && v >= 0 && v <= 1023, `${id} ${w}x${h}`);
    }
  }
});

test('hgray / vgray', () => {
  const w = 1920, b = MT.renderPattern('hgray', w, 4, {});
  assert.deepStrictEqual(px(b, w, 0, 2), [0, 0, 0]);
  assert.deepStrictEqual(px(b, w, w - 1, 2), [1023, 1023, 1023]);
  const e = Math.round(959 * 1023 / 1919);
  assert.deepStrictEqual(px(b, w, 959, 0), [e, e, e]);
  const v = MT.renderPattern('vgray', 3, 5, {});
  assert.deepStrictEqual(px(v, 3, 1, 0), [0, 0, 0]);
  assert.deepStrictEqual(px(v, 3, 2, 4), [1023, 1023, 1023]);
  assert.strictEqual(px(v, 3, 0, 2)[0], ramp(2, 5));
});

test('steps n=4', () => {
  const b = MT.renderPattern('steps', 8, 1, { n: 4 });
  const exp = [0, 0, 341, 341, 682, 682, 1023, 1023];
  assert.deepStrictEqual(exp.map((_, x) => px(b, 8, x, 0)[0]), exp);
});

test('border odd and even width, cross, colors', () => {
  const fg = [1023, 0, 5], bg = [1, 2, 3];
  // odd width 3 on 11x9: cx0=4 (4..6), cy0=3 (3..5)
  let w = 11, h = 9, b = MT.renderPattern('border', w, h, { width: 3, fg, bg, cross: true });
  const isFg = (x, y) => px(b, w, x, y).join() === fg.join();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const exp = x < 3 || x >= w - 3 || y < 3 || y >= h - 3 || (x >= 4 && x <= 6) || (y >= 3 && y <= 5);
    assert.strictEqual(isFg(x, y), exp, `(${x},${y})`);
    if (!exp) assert.deepStrictEqual(px(b, w, x, y), bg);
  }
  // even width 2 on 10x10: cx0=4 (4..5)
  w = 10; h = 10; b = MT.renderPattern('border', w, h, { width: 2, fg, bg, cross: true });
  assert.ok(isFg(4, 0) && isFg(5, 9) && isFg(4, 4) && isFg(2, 5) && isFg(0, 0) && isFg(9, 9));
  assert.ok(!isFg(3, 3) && !isFg(6, 6) && !isFg(3, 6));
  // cross off
  b = MT.renderPattern('border', w, h, { width: 1, fg, bg, cross: false });
  assert.ok(!isFg(5, 5) && isFg(0, 5) && isFg(9, 5) && isFg(5, 0) && isFg(5, 9));
  // width larger than image stays valid
  b = MT.renderPattern('border', 4, 4, { width: 256, fg, bg });
  assert.ok(b.every((v, i) => v === fg[i % 3]));
});

test('solid', () => {
  const b = MT.renderPattern('solid', 3, 2, { color: [10, 20, 30] });
  for (let i = 0; i < 6; i++) assert.deepStrictEqual(px(b, 3, i % 3, Math.floor(i / 3)), [10, 20, 30]);
});

test('bars 8 segments', () => {
  const exp = [[1023, 1023, 1023], [1023, 1023, 0], [0, 1023, 1023], [0, 1023, 0],
    [1023, 0, 1023], [1023, 0, 0], [0, 0, 1023], [0, 0, 0]];
  const b = MT.renderPattern('bars', 16, 2, {});
  for (let i = 0; i < 8; i++) {
    assert.deepStrictEqual(px(b, 16, i * 2, 1), exp[i]);
    assert.deepStrictEqual(px(b, 16, i * 2 + 1, 0), exp[i]);
  }
});

test('checker top-left white, alternation', () => {
  const b = MT.renderPattern('checker', 8, 8, { size: 2 });
  assert.deepStrictEqual(px(b, 8, 0, 0), [1023, 1023, 1023]);
  assert.deepStrictEqual(px(b, 8, 1, 1), [1023, 1023, 1023]);
  assert.deepStrictEqual(px(b, 8, 2, 0), [0, 0, 0]);
  assert.deepStrictEqual(px(b, 8, 0, 2), [0, 0, 0]);
  assert.deepStrictEqual(px(b, 8, 2, 2), [1023, 1023, 1023]);
});

test('rgbramp three bands', () => {
  const w = 5, h = 6, b = MT.renderPattern('rgbramp', w, h, {});
  for (let x = 0; x < w; x++) {
    const v = ramp(x, w);
    for (const y of [0, 1]) assert.deepStrictEqual(px(b, w, x, y), [v, 0, 0]);
    for (const y of [2, 3]) assert.deepStrictEqual(px(b, w, x, y), [0, v, 0]);
    for (const y of [4, 5]) assert.deepStrictEqual(px(b, w, x, y), [0, 0, v]);
  }
});

test('to8', () => {
  assert.strictEqual(MT.to8(0), 0);
  assert.strictEqual(MT.to8(1023), 255);
  assert.strictEqual(MT.to8(512), 128);
});

test('filename', () => {
  assert.strictEqual(MT.filename('bars', 1920, 1080, 'bmp'), 'bars_1920x1080.bmp');
  assert.strictEqual(MT.filename('bars', 1920, 1080, 'bmp', '_30bit'), 'bars_1920x1080_30bit.bmp');
});

function sampleBuf(w, h) {
  const b = MT.createBuffer(w, h);
  for (let i = 0; i < b.length; i++) b[i] = (i * 97 + 13) % 1024;
  return b;
}

test('BMP24 sizes, header, bottom-up, BGR', () => {
  for (const w of [1, 2, 3, 4, 5]) {
    const h = 3, buf = sampleBuf(w, h), out = MT.encodeBMP24(buf, w, h);
    const stride = Math.ceil(w * 3 / 4) * 4;
    assert.ok(out instanceof Uint8Array);
    assert.strictEqual(out.length, 54 + stride * h);
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    assert.strictEqual(String.fromCharCode(out[0], out[1]), 'BM');
    assert.strictEqual(dv.getUint32(2, true), out.length);
    assert.strictEqual(dv.getUint32(6, true), 0);
    assert.strictEqual(dv.getUint32(10, true), 54);
    assert.strictEqual(dv.getUint32(14, true), 40);
    assert.strictEqual(dv.getInt32(18, true), w);
    assert.strictEqual(dv.getInt32(22, true), h);
    assert.strictEqual(dv.getUint16(26, true), 1);
    assert.strictEqual(dv.getUint16(28, true), 24);
    assert.strictEqual(dv.getUint32(30, true), 0);
    assert.strictEqual(dv.getUint32(34, true), stride * h);
    assert.strictEqual(dv.getInt32(38, true), 2835);
    assert.strictEqual(dv.getInt32(42, true), 2835);
    assert.strictEqual(dv.getUint32(46, true), 0);
    assert.strictEqual(dv.getUint32(50, true), 0);
    for (let row = 0; row < h; row++) {
      const y = h - 1 - row; // first stored row = bottom image row
      for (let x = 0; x < w; x++) {
        const o = 54 + row * stride + x * 3, p = px(buf, w, x, y);
        assert.deepStrictEqual([out[o], out[o + 1], out[o + 2]], [MT.to8(p[2]), MT.to8(p[1]), MT.to8(p[0])]);
      }
      for (let k = w * 3; k < stride; k++) assert.strictEqual(out[54 + row * stride + k], 0);
    }
  }
});

test('BMP24 bottom row first with distinct rows', () => {
  const b = MT.createBuffer(1, 2);
  b.set([1023, 0, 0, 0, 0, 1023]); // top red, bottom blue
  const out = MT.encodeBMP24(b, 1, 2);
  assert.deepStrictEqual([out[54], out[55], out[56]], [255, 0, 0]); // blue in BGR
  assert.deepStrictEqual([out[58], out[59], out[60]], [0, 0, 255]); // red in BGR
});

test('BMP30 header, masks, packing', () => {
  const w = 3, h = 2, buf = MT.createBuffer(w, h);
  buf.set([1023, 0, 1], 0); // top-left
  buf.set([0, 1023, 0], (1 * w + 2) * 3); // bottom-right
  const out = MT.encodeBMP30(buf, w, h), dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  assert.strictEqual(out.length, 138 + w * 4 * h);
  assert.strictEqual(String.fromCharCode(out[0], out[1]), 'BM');
  assert.strictEqual(dv.getUint32(2, true), out.length);
  assert.strictEqual(dv.getUint32(6, true), 0);
  assert.strictEqual(dv.getUint32(10, true), 138);
  assert.strictEqual(dv.getUint32(14, true), 124);
  assert.strictEqual(dv.getInt32(18, true), w);
  assert.strictEqual(dv.getInt32(22, true), h);
  assert.strictEqual(dv.getUint16(26, true), 1);
  assert.strictEqual(dv.getUint16(28, true), 32);
  assert.strictEqual(dv.getUint32(30, true), 3);
  assert.strictEqual(dv.getUint32(34, true), w * 4 * h);
  assert.strictEqual(dv.getInt32(38, true), 2835);
  assert.strictEqual(dv.getInt32(42, true), 2835);
  assert.strictEqual(dv.getUint32(46, true), 0);
  assert.strictEqual(dv.getUint32(50, true), 0);
  assert.strictEqual(dv.getUint32(54, true), 0x3FF00000);
  assert.strictEqual(dv.getUint32(58, true), 0x000FFC00);
  assert.strictEqual(dv.getUint32(62, true), 0x000003FF);
  assert.strictEqual(dv.getUint32(66, true), 0);
  assert.strictEqual(dv.getUint32(70, true), 0x73524742);
  for (let o = 74; o < 14 + 108; o += 4) assert.strictEqual(dv.getUint32(o, true), 0, `offset ${o}`);
  assert.strictEqual(dv.getUint32(14 + 108, true), 4);
  for (let o = 14 + 112; o < 138; o += 4) assert.strictEqual(dv.getUint32(o, true), 0, `offset ${o}`);
  // bottom row stored first; top-left is at start of second stored row
  assert.strictEqual(dv.getUint32(138 + 2 * 4, true), (1023 << 10) >>> 0);
  assert.strictEqual(dv.getUint32(138 + w * 4, true), 0x3FF00001);
});

test('PPM3 header, lines, round trip, chunking', () => {
  const w = 7, h = 5, buf = sampleBuf(w, h);
  const chunks = MT.encodePPM3(buf, w, h), text = chunks.join('');
  assert.ok(Array.isArray(chunks) && chunks.every((c) => typeof c === 'string'));
  assert.ok(text.startsWith(`P3\n# This PPM is created by MonitorTester\n${w} ${h}\n1023\n`));
  assert.ok(text.endsWith('\n'));
  const lines = text.split('\n');
  assert.strictEqual(lines.pop(), '');
  assert.strictEqual(lines.length, 4 + w * h);
  const pad = (v) => String(v).padStart(5, ' ');
  // one pixel per line, each sample right-aligned to width 5, single-space separated
  lines.slice(4).forEach((l, p) => {
    assert.strictEqual(l, pad(buf[p * 3]) + ' ' + pad(buf[p * 3 + 1]) + ' ' + pad(buf[p * 3 + 2]));
  });
  assert.strictEqual(MT.encodePPM3(new Uint16Array([64, 104, 1023]), 1, 1).join('').split('\n')[4], '   64   104  1023');
  // multi-chunk: large image splits and concatenation still parses
  const W = 1500, H = 400, big = sampleBuf(W, H), bc = MT.encodePPM3(big, W, H);
  assert.ok(bc.length > 1);
  assert.ok(bc.every((c) => c.length <= 1.2 * 1024 * 1024));
  const bl = bc.join('').split('\n');
  assert.strictEqual(bl.length, 4 + W * H + 1);
  assert.deepStrictEqual(bl.slice(4, 4 + W * H).join(' ').trim().split(/\s+/).map(Number), Array.from(big));
});

test('parameter normalization', () => {
  const n = MT.normalizeParams;
  assert.deepStrictEqual(n('solid', { color: [2000, -5, 1023.7] }).color, [1023, 0, 1023]);
  assert.strictEqual(n('steps', { n: 0 }).n, 2);
  assert.strictEqual(n('steps', { n: 5000 }).n, 1024);
  assert.strictEqual(n('checker', { size: 0 }).size, 1);
  assert.strictEqual(n('border', { width: 0 }).width, 1);
  assert.strictEqual(n('border', { width: 2.6 }).width, 3);
  assert.strictEqual(n('steps', { n: NaN }).n, 16);
  assert.strictEqual(n('steps', { n: 'abc' }).n, 16);
  assert.strictEqual(n('steps', {}).n, 16);
  assert.deepStrictEqual(n('solid', { color: [NaN, 5, 'x'] }).color, [1023, 5, 1023]);
  assert.deepStrictEqual(n('solid').color, [1023, 1023, 1023]);
  const b = n('border', { cross: 0 });
  assert.strictEqual(b.cross, false);
  assert.strictEqual(n('border', {}).cross, true);
  assert.deepStrictEqual(n('border', {}).bg, [0, 0, 0]);
  // input not mutated
  const inp = { n: 3.2 }; n('steps', inp); assert.strictEqual(inp.n, 3.2);
});

test('rendering with wild params yields valid integer buffers', () => {
  const wild = { n: 99999, width: -4, size: 1e9, color: [1e9, -1e9, 0.4], fg: [5000, 5000, 5000], bg: [-1, -1, -1], cross: 1 };
  for (const id of ids) {
    const b = MT.renderPattern(id, 17, 13, wild);
    for (const v of b) assert.ok(Number.isInteger(v) && v >= 0 && v <= 1023, id);
  }
});

test('renderPattern rejects illegal sizes', () => {
  assert.throws(() => MT.renderPattern('hgray', 0, 10, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', 7681, 10, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', 1.5, 10, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', 10, 0, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', 10, 4321, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', 10, 2.5, {}), RangeError);
  assert.throws(() => MT.renderPattern('hgray', NaN, 10, {}), RangeError);
  assert.doesNotThrow(() => MT.renderPattern('hgray', 7680, 1, {}));
});

test('extreme color BMP30/PPM have no sample > 1023', () => {
  const buf = MT.renderPattern('solid', 4, 3, { color: [99999, 99999, 99999] });
  const bmp = MT.encodeBMP30(buf, 4, 3), dv = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);
  for (let o = 138; o < bmp.length; o += 4) {
    const v = dv.getUint32(o, true);
    assert.ok((v >>> 30) === 0);
    assert.ok(((v >>> 20) & 0x3FF) <= 1023 && ((v >>> 10) & 0x3FF) <= 1023 && (v & 0x3FF) <= 1023);
    assert.strictEqual(v, 0x3FFFFFFF);
  }
  const nums = MT.encodePPM3(buf, 4, 3).join('').split('\n').slice(4).join(' ').trim().split(/\s+/).map(Number);
  assert.strictEqual(nums.length, 36);
  assert.ok(nums.every((n) => n <= 1023 && n === 1023));
});
