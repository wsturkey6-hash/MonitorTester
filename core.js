/* MonitorTester core: pattern registry, encoders. Classic script; global MT. */
var MT = (function () {
  'use strict';

  var MAX_W = 7680, MAX_H = 4320;

  function ramp(i, n) { return n <= 1 ? 0 : Math.round(i * 1023 / (n - 1)); }
  function to8(v) { return Math.round(v * 255 / 1023); }

  function setPx(buf, o, r, g, b) { buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; }

  var BAR_COLORS = [
    [1023, 1023, 1023], [1023, 1023, 0], [0, 1023, 1023], [0, 1023, 0],
    [1023, 0, 1023], [1023, 0, 0], [0, 0, 1023], [0, 0, 0]
  ];

  var PATTERNS = {
    hgray: {
      label: '水平連續灰階', params: [],
      render: function (buf, w, h) {
        for (var x = 0; x < w; x++) {
          var v = ramp(x, w);
          for (var y = 0; y < h; y++) setPx(buf, (y * w + x) * 3, v, v, v);
        }
      }
    },
    vgray: {
      label: '垂直連續灰階', params: [],
      render: function (buf, w, h) {
        for (var y = 0; y < h; y++) {
          var v = ramp(y, h);
          for (var x = 0; x < w; x++) setPx(buf, (y * w + x) * 3, v, v, v);
        }
      }
    },
    steps: {
      label: '階梯灰階',
      params: [{ key: 'n', label: '階數', type: 'int', min: 2, max: 1024, default: 16 }],
      render: function (buf, w, h, p) {
        var n = p.n;
        for (var x = 0; x < w; x++) {
          var v = ramp(Math.floor(x * n / w), n);
          for (var y = 0; y < h; y++) setPx(buf, (y * w + x) * 3, v, v, v);
        }
      }
    },
    border: {
      label: '外框與十字',
      params: [
        { key: 'width', label: '線寬 (px)', type: 'int', min: 1, max: 256, default: 1 },
        { key: 'fg', label: '前景色', type: 'color10', default: [1023, 1023, 1023] },
        { key: 'bg', label: '背景色', type: 'color10', default: [0, 0, 0] },
        { key: 'cross', label: '中央十字', type: 'bool', default: true }
      ],
      render: function (buf, w, h, p) {
        var wd = p.width, fg = p.fg, bg = p.bg;
        var cx0 = Math.floor((w - wd) / 2), cy0 = Math.floor((h - wd) / 2);
        for (var y = 0; y < h; y++) {
          var rowEdge = y < wd || y >= h - wd;
          var rowCross = p.cross && y >= cy0 && y <= cy0 + wd - 1;
          for (var x = 0; x < w; x++) {
            var on = rowEdge || rowCross || x < wd || x >= w - wd ||
              (p.cross && x >= cx0 && x <= cx0 + wd - 1);
            var c = on ? fg : bg;
            setPx(buf, (y * w + x) * 3, c[0], c[1], c[2]);
          }
        }
      }
    },
    solid: {
      label: '純色',
      params: [{ key: 'color', label: '顏色', type: 'color10', default: [1023, 1023, 1023] }],
      render: function (buf, w, h, p) {
        var c = p.color, n = w * h;
        for (var i = 0; i < n; i++) setPx(buf, i * 3, c[0], c[1], c[2]);
      }
    },
    bars: {
      label: '彩條', params: [],
      render: function (buf, w, h) {
        for (var x = 0; x < w; x++) {
          var c = BAR_COLORS[Math.floor(x * 8 / w)];
          for (var y = 0; y < h; y++) setPx(buf, (y * w + x) * 3, c[0], c[1], c[2]);
        }
      }
    },
    checker: {
      label: '棋盤格',
      params: [{ key: 'size', label: '格寬 (px)', type: 'int', min: 1, max: 1024, default: 64 }],
      render: function (buf, w, h, p) {
        var s = p.size;
        for (var y = 0; y < h; y++) {
          var fy = Math.floor(y / s);
          for (var x = 0; x < w; x++) {
            var v = ((Math.floor(x / s) + fy) % 2 === 0) ? 1023 : 0;
            setPx(buf, (y * w + x) * 3, v, v, v);
          }
        }
      }
    },
    rgbramp: {
      label: 'RGB 連續漸層', params: [],
      render: function (buf, w, h) {
        for (var y = 0; y < h; y++) {
          var band = Math.floor(y * 3 / h);
          for (var x = 0; x < w; x++) {
            var o = (y * w + x) * 3;
            buf[o] = buf[o + 1] = buf[o + 2] = 0;
            buf[o + band] = ramp(x, w);
          }
        }
      }
    }
  };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function missing(v) { return v === undefined || v === null || v === ''; }
  function num(v) { return missing(v) ? NaN : Number(v); }

  function normalizeParams(id, params) {
    var spec = PATTERNS[id];
    if (!spec) throw new Error('Unknown pattern: ' + id);
    var src = params || {}, out = {};
    spec.params.forEach(function (ps) {
      var v = src[ps.key];
      if (ps.type === 'int') {
        var n = num(v);
        out[ps.key] = isNaN(n) ? ps.default : clamp(Math.round(n), ps.min, ps.max) + 0;
      } else if (ps.type === 'color10') {
        var arr = Array.isArray(v) ? v : [];
        out[ps.key] = [0, 1, 2].map(function (i) {
          var c = num(arr[i]);
          return isNaN(c) ? ps.default[i] : clamp(Math.round(c), 0, 1023) + 0;
        });
      } else if (ps.type === 'bool') {
        out[ps.key] = v === undefined ? ps.default : !!v;
      }
    });
    return out;
  }

  function checkSize(w, h) {
    if (!Number.isInteger(w) || w < 1 || w > MAX_W) throw new RangeError('width must be an integer in 1..' + MAX_W);
    if (!Number.isInteger(h) || h < 1 || h > MAX_H) throw new RangeError('height must be an integer in 1..' + MAX_H);
  }

  function createBuffer(w, h) {
    checkSize(w, h);
    return new Uint16Array(w * h * 3);
  }

  function renderPattern(id, w, h, params) {
    var spec = PATTERNS[id];
    if (!spec) throw new Error('Unknown pattern: ' + id);
    checkSize(w, h);
    var p = normalizeParams(id, params);
    var buf = createBuffer(w, h);
    spec.render(buf, w, h, p);
    return buf;
  }

  function fileHeader(size, offset) {
    var u = new Uint8Array(14), dv = new DataView(u.buffer);
    u[0] = 0x42; u[1] = 0x4D;
    dv.setUint32(2, size, true);
    dv.setUint32(10, offset, true);
    return u;
  }

  function encodeBMP24(buf, w, h) {
    var stride = Math.ceil(w * 3 / 4) * 4, imageSize = stride * h, offset = 54;
    var out = new Uint8Array(offset + imageSize), dv = new DataView(out.buffer);
    out.set(fileHeader(offset + imageSize, offset), 0);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(30, 0, true);
    dv.setUint32(34, imageSize, true);
    dv.setInt32(38, 2835, true);
    dv.setInt32(42, 2835, true);
    for (var row = 0; row < h; row++) {
      var src = (h - 1 - row) * w * 3, dst = offset + row * stride;
      for (var x = 0; x < w; x++) {
        var s = src + x * 3, d = dst + x * 3;
        out[d] = to8(buf[s + 2]);
        out[d + 1] = to8(buf[s + 1]);
        out[d + 2] = to8(buf[s]);
      }
    }
    return out;
  }

  function encodeBMP30(buf, w, h) {
    var offset = 138, imageSize = w * 4 * h;
    var out = new Uint8Array(offset + imageSize), dv = new DataView(out.buffer);
    out.set(fileHeader(offset + imageSize, offset), 0);
    dv.setUint32(14, 124, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 32, true);
    dv.setUint32(30, 3, true);
    dv.setUint32(34, imageSize, true);
    dv.setInt32(38, 2835, true);
    dv.setInt32(42, 2835, true);
    dv.setUint32(46, 0, true);
    dv.setUint32(50, 0, true);
    dv.setUint32(54, 0x3FF00000, true);
    dv.setUint32(58, 0x000FFC00, true);
    dv.setUint32(62, 0x000003FF, true);
    dv.setUint32(66, 0, true);
    dv.setUint32(70, 0x73524742, true);
    dv.setUint32(14 + 108, 4, true); // intent (endpoints+gamma zero)
    for (var row = 0; row < h; row++) {
      var src = (h - 1 - row) * w * 3, dst = offset + row * w * 4;
      for (var x = 0; x < w; x++) {
        var s = src + x * 3;
        var px = ((buf[s] << 20) | (buf[s + 1] << 10) | buf[s + 2]) >>> 0;
        dv.setUint32(dst + x * 4, px, true);
      }
    }
    return out;
  }

  // Each sample right-aligned to 5 chars, e.g. "   64", "  104", " 1023".
  var NUM_STR = [];
  for (var ni = 0; ni <= 1023; ni++) NUM_STR.push(('    ' + ni).slice(-5));
  var PPM_COMMENT = '# This PPM is created by MonitorTester';

  // One pixel per line with padded samples. order: 'bgr' (default) -> "B G R\n", 'rgb' -> "R G B\n".
  function encodePPM3(buf, w, h, order) {
    if (order === undefined) order = 'bgr';
    if (order !== 'rgb' && order !== 'bgr') throw new RangeError('PPM channel order must be "rgb" or "bgr"');
    var o0 = order === 'rgb' ? 0 : 2, o2 = 2 - o0;
    var LIMIT = 1 << 20, chunks = [], cur = [], curLen = 0;
    cur.push('P3\n' + PPM_COMMENT + '\n' + w + ' ' + h + '\n1023\n');
    curLen = cur[0].length;
    for (var y = 0; y < h; y++) {
      var parts = new Array(w), base = y * w * 3;
      for (var x = 0, i = base; x < w; x++, i += 3) {
        parts[x] = NUM_STR[buf[i + o0]] + ' ' + NUM_STR[buf[i + 1]] + ' ' + NUM_STR[buf[i + o2]] + '\n';
      }
      var line = parts.join('');
      if (curLen + line.length > LIMIT && cur.length) {
        chunks.push(cur.join(''));
        cur = []; curLen = 0;
      }
      cur.push(line); curLen += line.length;
    }
    if (cur.length) chunks.push(cur.join(''));
    return chunks;
  }

  function filename(id, w, h, ext, suffix) { return id + '_' + w + 'x' + h + (suffix || '') + '.' + ext; }

  return {
    MAX_W: MAX_W, MAX_H: MAX_H, PATTERNS: PATTERNS,
    normalizeParams: normalizeParams, createBuffer: createBuffer, renderPattern: renderPattern,
    to8: to8, encodeBMP24: encodeBMP24, encodeBMP30: encodeBMP30, encodePPM3: encodePPM3,
    filename: filename
  };
})();
if (typeof module !== 'undefined') module.exports = MT;
