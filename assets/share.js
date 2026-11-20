/* 分享回路：在本机用 Canvas 生成学习成果卡 / 模板分享卡，并生成课程或模板二维码。
   二维码编码器为项目内实现（byte 模式、纠错等级 M、版本 1–10），不依赖第三方库。
   卡片只在浏览器本地生成，不上传任何数据。 */
window.SHARE = (function () {
  'use strict';

  var BRAND = 'AI办公与写作实战';
  var CARD_W = 1080;
  var CARD_H = 1440;

  /* ---------- QR 编码器 ---------- */
  var QR = (function () {
    var RS_M = {
      1: [[1, 26, 16]],
      2: [[1, 44, 28]],
      3: [[1, 70, 44]],
      4: [[2, 50, 32]],
      5: [[2, 67, 43]],
      6: [[4, 43, 27]],
      7: [[4, 49, 31]],
      8: [[2, 60, 38], [2, 61, 39]],
      9: [[3, 58, 36], [2, 59, 37]],
      10: [[4, 69, 43], [1, 70, 44]]
    };
    var ALIGN = {
      1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
      6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
    };
    var CAPACITY_M = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106, 7: 122, 8: 152, 9: 180, 10: 213 };
    var GF_EXP = new Array(512);
    var GF_LOG = new Array(256);
    (function () {
      var x = 1;
      for (var i = 0; i < 255; i++) {
        GF_EXP[i] = x;
        GF_LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
      }
      for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
    })();

    function mul(a, b) {
      if (!a || !b) return 0;
      return GF_EXP[GF_LOG[a] + GF_LOG[b]];
    }
    function utf8(str) {
      var out = [];
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
          var d = str.charCodeAt(++i);
          if (d >= 0xdc00 && d <= 0xdfff) c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        }
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
      return out;
    }
    function pickVersion(len) {
      for (var v = 1; v <= 10; v++) if (CAPACITY_M[v] >= len) return v;
      return 0;
    }
    function blocksFor(version) {
      var table = RS_M[version], list = [];
      for (var i = 0; i < table.length; i++) {
        for (var j = 0; j < table[i][0]; j++) list.push({ total: table[i][1], data: table[i][2] });
      }
      return list;
    }
    function dataCapacity(version) {
      var blocks = blocksFor(version), n = 0;
      for (var i = 0; i < blocks.length; i++) n += blocks[i].data;
      return n;
    }
    function encodePayload(bytes, version) {
      var bits = [];
      function put(value, length) {
        for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
      }
      put(4, 4);
      put(bytes.length, version < 10 ? 8 : 16);
      for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);
      var total = dataCapacity(version) * 8;
      if (bits.length > total) throw new Error('QR payload overflow');
      put(0, Math.min(4, total - bits.length));
      while (bits.length % 8) bits.push(0);
      var out = [];
      for (var j = 0; j < bits.length; j += 8) {
        var b = 0;
        for (var k = 0; k < 8; k++) b = (b << 1) | bits[j + k];
        out.push(b);
      }
      while (out.length < total / 8) {
        out.push(0xec);
        if (out.length < total / 8) out.push(0x11);
      }
      return out;
    }
    function generator(ecLen) {
      var g = [1];
      for (var i = 0; i < ecLen; i++) {
        var next = new Array(g.length + 1);
        for (var j = 0; j < next.length; j++) next[j] = 0;
        for (var k = 0; k < g.length; k++) {
          next[k] ^= g[k];
          next[k + 1] ^= mul(g[k], GF_EXP[i]);
        }
        g = next;
      }
      return g;
    }
    function remainder(data, ecLen) {
      var g = generator(ecLen);
      var rem = new Array(ecLen);
      for (var i = 0; i < ecLen; i++) rem[i] = 0;
      for (var j = 0; j < data.length; j++) {
        var factor = data[j] ^ rem[0];
        rem.shift();
        rem.push(0);
        if (factor) {
          for (var k = 0; k < ecLen; k++) rem[k] ^= mul(g[k + 1], factor);
        }
      }
      return rem;
    }
    function interleave(bytes, version) {
      var blocks = blocksFor(version), offset = 0, maxData = 0, maxEc = 0;
      var dataBlocks = [], ecBlocks = [];
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i], dc = b.data, ec = b.total - dc;
        var chunk = bytes.slice(offset, offset + dc);
        offset += dc;
        dataBlocks.push(chunk);
        ecBlocks.push(remainder(chunk, ec));
        maxData = Math.max(maxData, dc);
        maxEc = Math.max(maxEc, ec);
      }
      var out = [];
      for (var j = 0; j < maxData; j++) {
        for (var k = 0; k < dataBlocks.length; k++) if (j < dataBlocks[k].length) out.push(dataBlocks[k][j]);
      }
      for (var m = 0; m < maxEc; m++) {
        for (var n = 0; n < ecBlocks.length; n++) if (m < ecBlocks[n].length) out.push(ecBlocks[n][m]);
      }
      return out;
    }
    function bitLength(n) {
      var len = 0;
      while (n) { len++; n >>>= 1; }
      return len;
    }
    function formatBits(ecBits, mask) {
      var data = (ecBits << 3) | mask;
      var d = data << 10;
      while (bitLength(d) - bitLength(0x537) >= 0) d ^= 0x537 << (bitLength(d) - bitLength(0x537));
      return ((data << 10) | d) ^ 0x5412;
    }
    function versionBits(version) {
      var d = version << 12;
      while (bitLength(d) - bitLength(0x1f25) >= 0) d ^= 0x1f25 << (bitLength(d) - bitLength(0x1f25));
      return (version << 12) | d;
    }
    function maskAt(mask, i, j) {
      switch (mask) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return (i * j) % 2 + (i * j) % 3 === 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
      }
    }
    function setupFinder(m, size, row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          if (row + r < 0 || row + r >= size || col + c < 0 || col + c >= size) continue;
          m[row + r][col + c] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        }
      }
    }
    function setupAlignment(m, size, version) {
      var pos = ALIGN[version];
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i], col = pos[j];
          if (m[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              m[row + r][col + c] = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
            }
          }
        }
      }
    }
    function setupTiming(m, size) {
      for (var r = 8; r < size - 8; r++) if (m[r][6] == null) m[r][6] = (r % 2 === 0);
      for (var c = 8; c < size - 8; c++) if (m[6][c] == null) m[6][c] = (c % 2 === 0);
    }
    function placeFormat(m, size, mask, test) {
      var bits = formatBits(0, mask);
      for (var i = 0; i < 15; i++) {
        var dark = !test && ((bits >>> i) & 1) === 1;
        if (i < 6) m[i][8] = dark;
        else if (i < 8) m[i + 1][8] = dark;
        else m[size - 15 + i][8] = dark;
      }
      for (var j = 0; j < 15; j++) {
        var dark2 = !test && ((bits >>> j) & 1) === 1;
        if (j < 8) m[8][size - j - 1] = dark2;
        else if (j < 9) m[8][15 - j - 1 + 1] = dark2;
        else m[8][15 - j - 1] = dark2;
      }
      m[size - 8][8] = !test;
    }
    function placeVersion(m, size, version, test) {
      if (version < 7) return;
      var bits = versionBits(version);
      for (var i = 0; i < 18; i++) {
        var dark = !test && ((bits >>> i) & 1) === 1;
        m[Math.floor(i / 3)][i % 3 + size - 11] = dark;
        m[i % 3 + size - 11][Math.floor(i / 3)] = dark;
      }
    }
    function mapData(m, size, data, mask) {
      var inc = -1, row = size - 1, bitIndex = 7, byteIndex = 0;
      for (var col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (m[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              if (maskAt(mask, row, col - c)) dark = !dark;
              m[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
        }
      }
    }
    function penalty(m) {
      var size = m.length, lost = 0;
      for (var row = 0; row < size; row++) {
        for (var col = 0; col < size; col++) {
          var same = 0, dark = m[row][col];
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || row + r >= size) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || col + c >= size || (r === 0 && c === 0)) continue;
              if (dark === m[row + r][col + c]) same++;
            }
          }
          if (same > 5) lost += 3 + same - 5;
        }
      }
      for (var row2 = 0; row2 < size - 1; row2++) {
        for (var col2 = 0; col2 < size - 1; col2++) {
          var count = 0;
          if (m[row2][col2]) count++;
          if (m[row2 + 1][col2]) count++;
          if (m[row2][col2 + 1]) count++;
          if (m[row2 + 1][col2 + 1]) count++;
          if (count === 0 || count === 4) lost += 3;
        }
      }
      for (var row3 = 0; row3 < size; row3++) {
        for (var col3 = 0; col3 < size - 6; col3++) {
          if (m[row3][col3] && !m[row3][col3 + 1] && m[row3][col3 + 2] && m[row3][col3 + 3] &&
              m[row3][col3 + 4] && !m[row3][col3 + 5] && m[row3][col3 + 6]) lost += 40;
        }
      }
      for (var col4 = 0; col4 < size; col4++) {
        for (var row4 = 0; row4 < size - 6; row4++) {
          if (m[row4][col4] && !m[row4 + 1][col4] && m[row4 + 2][col4] && m[row4 + 3][col4] &&
              m[row4 + 4][col4] && !m[row4 + 5][col4] && m[row4 + 6][col4]) lost += 40;
        }
      }
      var darkCount = 0;
      for (var r5 = 0; r5 < size; r5++) for (var c5 = 0; c5 < size; c5++) if (m[r5][c5]) darkCount++;
      lost += Math.abs(100 * darkCount / size / size - 50) / 5 * 10;
      return lost;
    }
    function build(version, data, mask, test) {
      var size = version * 4 + 17;
      var m = new Array(size);
      for (var i = 0; i < size; i++) {
        m[i] = new Array(size);
        for (var j = 0; j < size; j++) m[i][j] = null;
      }
      setupFinder(m, size, 0, 0);
      setupFinder(m, size, size - 7, 0);
      setupFinder(m, size, 0, size - 7);
      setupAlignment(m, size, version);
      setupTiming(m, size);
      placeFormat(m, size, mask, test);
      placeVersion(m, size, version, test);
      mapData(m, size, data, mask);
      return m;
    }
    function matrix(text) {
      var bytes = utf8(text);
      var version = pickVersion(bytes.length);
      if (!version) return null;
      var payload = encodePayload(bytes, version);
      var codewords = interleave(payload, version);
      var bestMask = 0, bestScore = 0;
      for (var mask = 0; mask < 8; mask++) {
        var score = penalty(build(version, codewords, mask, true));
        if (mask === 0 || score < bestScore) { bestScore = score; bestMask = mask; }
      }
      return { version: version, mask: bestMask, size: version * 4 + 17, modules: build(version, codewords, bestMask, false) };
    }
    return { matrix: matrix };
  })();

  /* ---------- 链接与文案 ---------- */
  function homeUrl() {
    if (!/^https?:$/.test(location.protocol)) return '';
    try {
      var root = document.body.getAttribute('data-root') || './';
      return new URL(root, location.href).href.replace(/index\.html$/, '');
    } catch (e) {
      return '';
    }
  }
  function templateUrl(t) {
    var base = homeUrl();
    if (!base) return '';
    try {
      return new URL('templates/' + encodeURIComponent(t.id) + '/', base).href;
    } catch (e) {
      return '';
    }
  }
  function isLocalHost() {
    return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
  }
  function hasProgress(stats) {
    return !!(stats && (stats.done > 0 || stats.packCount > 0 || stats.practices > 0));
  }
  function courseText(stats, recommend) {
    stats = stats || {};
    var url = homeUrl();
    var lines = [];
    if (recommend || !hasProgress(stats)) {
      var moduleCount = window.COURSE ? window.COURSE.modules.length : 5;
      lines.push('推荐一门给职场人的免费 AI 办公课：《' + BRAND + '》');
      lines.push(moduleCount + ' 个模块，覆盖文书起草、会议纪要、数据初步分析和 PPT 框架；' + (window.TEMPLATES ? window.TEMPLATES.length : 17) + ' 条可填空提示词模板，学完能导出自己的模板包。');
      lines.push('不教“AI 万能”，而是练一套可核验的流程：AI 写初稿，人来签字。');
    } else {
      var done = stats.done + '/' + stats.total;
      if (stats.done >= stats.total) done = '全部 ' + stats.total + ' 个模块';
      var line;
      if (stats.done > 0) {
        line = '我在《' + BRAND + '》学完了' + done + '。';
        if (stats.packCount > 0) line += '在模板包里存了 ' + stats.packCount + ' 条模板、清单和记录。';
      } else {
        line = '我在《' + BRAND + '》整理了 ' + stats.packCount + ' 条模板、清单和记录，正在从模块一开始学。';
      }
      lines.push(line);
      lines.push('这门课不教“AI 万能”，而是练一套可核验的流程：AI 写初稿，人来签字。');
    }
    lines.push(url ? '免费、无需注册：' + url : '（课程链接会在部署到正式域名后生成）');
    return lines.join('\n');
  }
  function templateText(t) {
    var url = templateUrl(t);
    var lines = [
      '分享一条职场 AI 提示词模板：《' + t.title + '》',
      t.scene || '',
      url ? '复制后填好变量就能用：' + url : '（模板链接会在部署到正式域名后生成）',
      '—— 来自《' + BRAND + '》'
    ];
    return lines.filter(Boolean).join('\n');
  }

  /* ---------- Canvas 绘制 ---------- */
  function font(size, weight) {
    return (weight || 400) + ' ' + size + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function text(ctx, str, x, y, size, weight, color, align) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(str == null ? '' : str), x, y);
  }
  function wrap(ctx, str, maxW) {
    var lines = [];
    String(str == null ? '' : str).split('\n').forEach(function (para) {
      if (!para) { lines.push(''); return; }
      var line = '';
      for (var i = 0; i < para.length; i++) {
        var ch = para.charAt(i);
        var test = line + ch;
        if (line && ctx.measureText(test).width > maxW) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    });
    return lines;
  }
  function ellipsize(ctx, str, maxW) {
    var s = str;
    while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function paragraph(ctx, str, x, y, maxW, lineH, size, weight, color, maxLines) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var lines = wrap(ctx, str, maxW);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1], maxW);
    }
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lineH);
    return y + lines.length * lineH;
  }
  function pill(ctx, label, x, y, size) {
    ctx.font = font(size, 600);
    var w = ctx.measureText(label).width + 36;
    var h = size + 20;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 18, y + h / 2 + 1);
    return w;
  }
  function background(ctx) {
    var g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, '#0f766e');
    g.addColorStop(.55, '#0c5751');
    g.addColorStop(1, '#082f2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 2;
    [260, 190, 120].forEach(function (r) {
      ctx.beginPath();
      ctx.arc(CARD_W - 70, 140, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(40, CARD_H - 40, 240, 0, Math.PI * 2);
    ctx.stroke();
  }
  function header(ctx, right) {
    pill(ctx, BRAND, 72, 58, 24);
    if (right) text(ctx, right, 1008, 68, 20, 400, 'rgba(255,255,255,.66)', 'right');
  }
  function footer(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(72, 1320);
    ctx.lineTo(1008, 1320);
    ctx.stroke();
    text(ctx, BRAND + ' · 职场 AI 应用能力课', 72, 1348, 20, 400, 'rgba(255,255,255,.62)');
    text(ctx, '个人项目，不代表任何机构', 72, 1382, 17, 400, 'rgba(255,255,255,.42)');
  }
  function qr(ctx, matrix, x, y, box, hasUrl) {
    ctx.fillStyle = '#fff';
    rr(ctx, x, y, box, box, 18);
    ctx.fill();
    if (!matrix) {
      text(ctx, hasUrl ? '链接较长' : '部署后生成', x + box / 2, y + box / 2 - 28, 22, 600, '#0f766e', 'center');
      text(ctx, hasUrl ? '请用下方网址' : '二维码', x + box / 2, y + box / 2 + 2, 22, 400, '#626d80', 'center');
      return;
    }
    var total = matrix.size + 8;
    var cell = Math.floor(box / total);
    var offset = Math.floor((box - cell * total) / 2);
    ctx.fillStyle = '#0b3b38';
    for (var r = 0; r < matrix.size; r++) {
      for (var c = 0; c < matrix.size; c++) {
        if (matrix.modules[r][c]) ctx.fillRect(x + offset + (c + 4) * cell, y + offset + (r + 4) * cell, cell, cell);
      }
    }
  }
  function stat(ctx, x, y, value, label) {
    text(ctx, String(value), x, y, 58, 800, '#0f766e');
    text(ctx, label, x, y + 72, 22, 400, '#626d80');
  }
  function drawCourseCard(canvas, opts) {
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext('2d');
    var stats = opts.stats || {};
    var done = +stats.done || 0;
    var total = +stats.total || (window.COURSE ? window.COURSE.modules.length : 5);
    var pct = +stats.pct || 0;
    var packCount = +stats.packCount || 0;
    var practices = +stats.practices || 0;
    var recommend = !!opts.recommend || !hasProgress(stats);
    var name = String(opts.name || '').trim();
    background(ctx);
    header(ctx, name ? name + ' 的学习成果' : '个人项目');
    text(ctx, '职场 AI 应用能力课 · 约 10—12 小时', 72, 158, 24, 600, 'rgba(214,245,240,.82)');
    var y = paragraph(ctx, 'AI 写初稿\n人来签字', 72, 205, 900, 98, 80, 800, '#fff', 2);
    y = paragraph(ctx, '把判断、取舍与核验留给自己。', 72, y + 16, 820, 40, 28, 400, 'rgba(214,245,240,.86)', 1);

    /* 数据卡 */
    var cy = 500;
    ctx.fillStyle = '#fff';
    rr(ctx, 72, cy, 936, 380, 28);
    ctx.fill();
    text(ctx, recommend ? '这门课能给你什么' : '我的学习进度', 108, cy + 36, 24, 600, '#626d80');
    if (recommend) {
      text(ctx, '免费 · 无需注册', 972, cy + 40, 22, 600, '#0f766e', 'right');
    } else {
      text(ctx, pct + '%', 972, cy + 34, 30, 800, '#0f766e', 'right');
      ctx.fillStyle = '#e6efed';
      rr(ctx, 108, cy + 88, 864, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#0f766e';
      rr(ctx, 108, cy + 88, Math.max(6, 864 * pct / 100), 12, 6);
      ctx.fill();
    }
    var sx = [108, 400, 692];
    if (recommend) {
      stat(ctx, sx[0], cy + 140, (window.COURSE ? window.COURSE.modules.length : 5), '课程模块');
      stat(ctx, sx[1], cy + 140, (window.TEMPLATES ? window.TEMPLATES.length : 17), '提示词模板');
      stat(ctx, sx[2], cy + 140, stats.practiceTotal || 4, '实践任务');
    } else {
      stat(ctx, sx[0], cy + 140, done + '/' + total, '完成模块');
      stat(ctx, sx[1], cy + 140, packCount, '模板包条目');
      stat(ctx, sx[2], cy + 140, practices, '练习模块');
    }
    ctx.strokeStyle = '#e3e6ec';
    ctx.beginPath();
    ctx.moveTo(108, cy + 262);
    ctx.lineTo(972, cy + 262);
    ctx.stroke();
    var bottom;
    if (recommend) {
      bottom = '覆盖文书起草、会议纪要、数据初步分析与 PPT 框架。';
    } else if (done >= total) {
      bottom = '全部模块已完成，可以导出自己的 AI 办公模板包了。';
    } else if (stats.next) {
      bottom = '下一步：模块' + stats.next.no + ' · ' + stats.next.short;
    } else {
      bottom = '从模块一开始，边学边留下自己的模板包。';
    }
    text(ctx, bottom, 108, cy + 292, 24, 400, '#4a5468');
    text(ctx, '三道关口：事实核验 → 逻辑核验 → 合规核验', 108, cy + 338, 21, 600, '#0f766e');

    /* 二维码 */
    var qyy = 960;
    var matrix = opts.url ? QR.matrix(opts.url) : null;
    qr(ctx, matrix, 72, qyy, 220, !!opts.url);
    text(ctx, '扫码打开课程', 336, qyy + 10, 38, 800, '#fff');
    if (opts.url) {
      paragraph(ctx, opts.url, 336, qyy + 72, 640, 32, 22, 400, 'rgba(255,255,255,.82)', 2);
    } else {
      text(ctx, '链接会在部署到正式域名后生成', 336, qyy + 72, 22, 400, 'rgba(255,255,255,.82)');
    }
    text(ctx, '免费 · 无需注册 · 学习记录只保存在本机', 336, qyy + 140, 22, 400, 'rgba(255,255,255,.82)');
    text(ctx, '学完导出 Markdown，模板和练习都能带走。', 336, qyy + 178, 22, 400, 'rgba(255,255,255,.62)');
    footer(ctx);
  }
  function drawTemplateCard(canvas, opts) {
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext('2d');
    var t = opts.template || {};
    background(ctx);
    header(ctx, t.cat || '提示词模板');
    text(ctx, '可以直接复制的职场提示词', 72, 158, 24, 600, 'rgba(214,245,240,.82)');
    var y = paragraph(ctx, t.title || '提示词模板', 72, 202, 920, 86, 68, 800, '#fff', 3);
    y = paragraph(ctx, t.scene || '', 72, y + 14, 900, 38, 27, 400, 'rgba(214,245,240,.85)', 2);

    var cardY = Math.max(410, y + 36);
    var cardH = 1050 - cardY;
    ctx.fillStyle = '#fff';
    rr(ctx, 72, cardY, 936, cardH, 24);
    ctx.fill();
    text(ctx, '提示词预览', 108, cardY + 26, 22, 600, '#626d80');
    var promptLines = Math.max(5, Math.floor((cardH - 120) / 38));
    paragraph(ctx, t.body || '', 108, cardY + 66, 864, 38, 24, 400, '#1d2433', promptLines);
    text(ctx, '变量用 {{ }} 标出，复制后填写即可。', 108, cardY + cardH - 54, 21, 400, '#626d80');

    var qyy = 1090;
    var matrix = opts.url ? QR.matrix(opts.url) : null;
    qr(ctx, matrix, 72, qyy, 200, !!opts.url);
    text(ctx, '扫码打开这条模板', 320, qyy + 6, 36, 800, '#fff');
    if (opts.url) {
      paragraph(ctx, opts.url, 320, qyy + 64, 660, 30, 21, 400, 'rgba(255,255,255,.82)', 2);
    } else {
      text(ctx, '链接会在部署到正式域名后生成', 320, qyy + 64, 21, 400, 'rgba(255,255,255,.82)');
    }
    text(ctx, '填空、复制、粘贴到 AI 工具里就能用。', 320, qyy + 126, 22, 400, 'rgba(255,255,255,.72)');
    text(ctx, '来自《' + BRAND + '》', 320, qyy + 166, 22, 600, '#fff');
    footer(ctx);
  }

  /* ---------- 弹窗 ---------- */
  var dlg = null;
  var current = null;
  var nameTimer = null;

  function nameValue() {
    try { return localStorage.getItem('aiw:shareName') || ''; } catch (e) { return ''; }
  }
  function saveName(v) {
    try { localStorage.setItem('aiw:shareName', v); } catch (e) {}
  }
  function copyText(str) {
    if (window.App && window.App.copy) return window.App.copy(str);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(str).then(function () {
        if (window.App) window.App.toast('已复制到剪贴板');
      });
    }
  }
  function toast(msg) {
    if (window.App && window.App.toast) window.App.toast(msg);
  }
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'share-dialog';
    dlg.setAttribute('aria-labelledby', 'shareTitle');
    dlg.innerHTML = '<div class="share-head"><div><div class="widget-title">分享</div><h2 id="shareTitle" data-share-title>分享学习成果</h2></div>' +
      '<button type="button" class="share-close" data-share-close aria-label="关闭分享窗口">×</button></div>' +
      '<div class="share-body"><div class="share-preview"><canvas width="1080" height="1440" role="img" aria-label="分享卡片预览"></canvas></div>' +
      '<div class="share-controls"><p class="small muted" data-share-desc></p>' +
      '<div class="field" data-share-name-field><label for="shareName">署名（可选，只写进图片）</label>' +
      '<input type="text" id="shareName" maxlength="20" data-share-name placeholder="如：阿林"></div>' +
      '<p class="small share-note" data-share-note></p>' +
      '<div class="btn-row"><button type="button" class="btn primary" data-share-download>下载图片</button>' +
      '<button type="button" class="btn" data-share-copy>复制分享文案</button>' +
      '<button type="button" class="btn" data-share-native hidden>系统分享</button></div>' +
      '<p class="small muted">图片在本机生成，不会上传。手机端也可以长按图片保存。</p></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-share-close]')) { dlg.close(); return; }
      if (e.target.closest('[data-share-download]')) download();
      if (e.target.closest('[data-share-copy]')) copyText(shareText());
      if (e.target.closest('[data-share-native]')) nativeShare();
    });
    dlg.addEventListener('input', function (e) {
      if (!e.target.matches('[data-share-name]') || !current) return;
      var v = e.target.value;
      clearTimeout(nameTimer);
      nameTimer = setTimeout(function () {
        current.name = v;
        saveName(v);
        draw();
      }, 120);
    });
    return dlg;
  }
  function draw() {
    if (!current) return;
    var canvas = dlg.querySelector('canvas');
    if (current.kind === 'template') {
      drawTemplateCard(canvas, { template: current.template, url: current.url });
      canvas.setAttribute('aria-label', '《' + current.template.title + '》提示词模板分享卡片预览');
    } else {
      drawCourseCard(canvas, { stats: current.stats, name: current.name, recommend: current.recommend, url: current.url });
      canvas.setAttribute('aria-label', 'AI办公与写作实战学习成果卡片预览');
    }
  }
  function updateChrome() {
    var isTemplate = current.kind === 'template';
    dlg.querySelector('[data-share-title]').textContent = isTemplate ? '分享这条模板' : (current.recommend ? '分享这门课' : '分享学习成果');
    dlg.querySelector('[data-share-desc]').textContent = isTemplate
      ? '生成一张带模板预览和二维码的卡片，发给需要的人。'
      : '生成一张带学习进度和课程二维码的卡片，发给同事或学习群。';
    var nameField = dlg.querySelector('[data-share-name-field]');
    nameField.hidden = isTemplate;
    dlg.querySelector('[data-share-name]').value = current.name || '';
    var note = dlg.querySelector('[data-share-note]');
    var txt = '';
    if (location.protocol === 'file:') txt = '当前是本地文件，卡片里暂时没有链接和二维码；部署到正式网址后会自动生成。';
    else if (isLocalHost()) txt = '当前是本地地址，二维码只在本机有效；部署到正式域名后会自动换成正式链接。';
    else if (!current.url) txt = '暂时无法生成链接，请检查页面地址。';
    note.textContent = txt;
    note.hidden = !txt;
    var native = dlg.querySelector('[data-share-native]');
    native.hidden = !navigator.share;
  }
  function openCourseShare(stats, opts) {
    ensureDialog();
    stats = stats || {};
    current = {
      kind: 'course',
      stats: stats,
      name: nameValue(),
      recommend: !!(opts && opts.recommend) || !hasProgress(stats),
      url: homeUrl()
    };
    updateChrome();
    draw();
    if (!dlg.open) dlg.showModal();
  }
  function openTemplateShare(t) {
    ensureDialog();
    current = { kind: 'template', template: t, name: '', url: templateUrl(t) };
    updateChrome();
    draw();
    if (!dlg.open) dlg.showModal();
  }
  function shareText() {
    if (!current) return '';
    return current.kind === 'template' ? templateText(current.template) : courseText(current.stats, current.recommend);
  }
  function filename() {
    if (current.kind === 'template') {
      return (BRAND + '-提示词模板-' + current.template.title + '.png').replace(/[\\/:*?"<>|\s]+/g, '-');
    }
    return BRAND + '-学习成果.png';
  }
  function canvasBlob(cb) {
    var canvas = dlg.querySelector('canvas');
    if (canvas.toBlob) return canvas.toBlob(cb, 'image/png');
    try {
      var data = canvas.toDataURL('image/png').split(',')[1];
      var bin = atob(data);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      cb(new Blob([arr], { type: 'image/png' }));
    } catch (e) { cb(null); }
  }
  function download() {
    canvasBlob(function (blob) {
      if (!blob) { toast('图片生成失败，请换一个浏览器试试'); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('已生成分享图片');
    });
  }
  function nativeShare() {
    if (!navigator.share) return;
    var txt = shareText();
    var payload = { title: BRAND, text: txt };
    if (current.url && txt.indexOf(current.url) < 0) payload.url = current.url;
    if (navigator.canShare) {
      canvasBlob(function (blob) {
        if (blob && typeof File === 'function') {
          var file = new File([blob], filename(), { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            payload.files = [file];
            delete payload.url;
          }
        }
        navigator.share(payload).catch(function () {});
      });
    } else {
      navigator.share(payload).catch(function () {});
    }
  }

  return {
    openCourseShare: openCourseShare,
    openTemplateShare: openTemplateShare,
    homeUrl: homeUrl,
    templateUrl: templateUrl
  };
})();
