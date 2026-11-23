(function () {
  'use strict';
  var C = window.COURSE, T = window.TEMPLATES, W = window.WIDGETS, SEO = window.SEO;
  var app = document.getElementById('app');
  var sidebar = document.getElementById('sidebar');
  var PAGE_ROUTE = document.body.getAttribute('data-route') || '/';
  var ROOT = document.body.getAttribute('data-root') || './';
  var CLEAN_URLS = location.protocol === 'http:' || location.protocol === 'https:';
  var SITE_BASE = '/';
  if (CLEAN_URLS) {
    try { SITE_BASE = new URL(ROOT, location.href).pathname; } catch (e) { SITE_BASE = '/'; }
    var favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.setAttribute('href', SITE_BASE + 'assets/favicon.svg');
  }

  function hrefFor(route) {
    if (!CLEAN_URLS) return '#' + route;
    var base = SITE_BASE.replace(/\/$/, '');
    if (route === '/') return base + '/' || '/';
    return base + '/' + route.replace(/^\//, '').replace(/\/+$/, '') + '/';
  }
  function normalizeLinks(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('a[data-route]'), function (a) {
      var route = a.getAttribute('data-route');
      a.setAttribute('href', CLEAN_URLS ? hrefFor(route) : '#' + route);
    });
    if (!CLEAN_URLS) return;
    Array.prototype.forEach.call(scope.querySelectorAll('a[href^="#/"]'), function (a) {
      var route = a.getAttribute('href').slice(1);
      a.setAttribute('data-route', route);
      a.setAttribute('href', hrefFor(route));
    });
  }
  function fixAssets(html) {
    var base = CLEAN_URLS ? SITE_BASE : ROOT;
    return String(html == null ? '' : html).replace(/(src|poster|href)="assets\//g, '$1="' + base + 'assets/');
  }

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('aiw:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('aiw:' + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('aiw:' + k); } catch (e) {} }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择文本');
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制到剪贴板'); }, fallback);
    } else fallback();
  }

  function addToPack(item) {
    var pack = store.get('pack', []);
    item.id = 'p' + Date.now();
    item.ts = new Date().toISOString();
    pack.unshift(item);
    store.set('pack', pack);
    toast('已加入「我的模板包」');
  }

  /* ---------- progress ---------- */
  function modState(id) { return store.get('progress:' + id, { quiz: false, practice: false }); }
  function hasQuiz(m) { return !!(m.quiz && m.quiz.length); }
  function hasPractice(m) { return !!m.practice; }
  function modDone(m) {
    var s = modState(m.id);
    return (!hasPractice(m) || !!s.practice) && (!hasQuiz(m) || !!s.quiz);
  }
  function modStarted(m) {
    var s = modState(m.id);
    return !!((hasPractice(m) && s.practice) || (hasQuiz(m) && s.quiz));
  }
  function setModState(id, patch) {
    var s = modState(id);
    for (var k in patch) s[k] = patch[k];
    store.set('progress:' + id, s);
    updateProgress();
  }
  function updateProgress() {
    var total = 0, done = 0;
    C.modules.forEach(function (m) {
      total += (hasPractice(m) ? 1 : 0) + (hasQuiz(m) ? 1 : 0);
      var s = modState(m.id);
      if (hasPractice(m) && s.practice) done++;
      if (hasQuiz(m) && s.quiz) done++;
    });
    var pct = Math.round(done / total * 100);
    document.getElementById('topProgressText').textContent = pct + '%';
    document.getElementById('topProgressBar').style.width = pct + '%';
    renderNav();
    return pct;
  }

  /* ---------- nav ---------- */
  var currentRoute = '/';
  function renderNav() {
    var html = '<a href="#/" data-r="/"><span class="ico">⌂</span>课程首页</a><h4>课程模块</h4>';
    C.modules.forEach(function (m, i) {
      var done = modDone(m);
      var cls = done ? ' done' : '';
      html += '<a href="#/m/' + m.id + '" data-r="/m/' + m.id + '" class="' + cls + '"><span class="num">' + (done ? '✓' : (i + 1)) + '</span>' + esc(m.short) + '</a>';
    });
    html += '<h4>工具箱</h4>' +
      '<a href="#/tools" data-r="/tools"><span class="ico">▸</span>工具实操</a>' +
      '<a href="#/templates" data-r="/templates"><span class="ico">▤</span>提示词模板库</a>' +
      '<a href="#/workshop" data-r="/workshop"><span class="ico">✎</span>提示词工坊</a>' +
      '<a href="#/checklist" data-r="/checklist"><span class="ico">☑</span>输出核验助手</a>' +
      '<a href="#/pack" data-r="/pack"><span class="ico">★</span>我的模板包</a>';
    sidebar.innerHTML = html;
    var base = currentRoute.split('/').slice(0, 3).join('/');
    if (base.indexOf('/templates') === 0) base = '/templates';
    Array.prototype.forEach.call(sidebar.querySelectorAll('a'), function (a) {
      if (a.getAttribute('data-r') === base || (base === '' && a.getAttribute('data-r') === '/')) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
    normalizeLinks(sidebar);
  }

  document.getElementById('menuBtn').addEventListener('click', function () {
    var open = sidebar.classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  sidebar.addEventListener('click', function (e) {
    if (!e.target.closest('a')) return;
    sidebar.classList.remove('open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
  });

  /* 动态生成的少量链接可能来不及改写 href，点击时兜底跳转到静态地址。 */
  document.addEventListener('click', function (e) {
    if (!CLEAN_URLS || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a || a.hasAttribute('data-share-course')) return;
    e.preventDefault();
    location.href = hrefFor(a.getAttribute('href').slice(1));
  });

  /* 分享入口：页脚、模板包页和模板详情页共用。 */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!window.SHARE) return;
    var course = e.target.closest ? e.target.closest('[data-share-course]') : null;
    if (course) {
      e.preventDefault();
      window.SHARE.openCourseShare(learningStats(), { recommend: true });
      return;
    }
    var card = e.target.closest ? e.target.closest('[data-share-card]') : null;
    if (card) {
      e.preventDefault();
      window.SHARE.openCourseShare(learningStats());
    }
  });

  /* ---------- seo ---------- */
  function setMetaContent(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  }
  function applySeo(meta) {
    var desc = meta.desc || '';
    document.title = meta.title;
    setMetaContent('meta[name="description"]', desc);
    setMetaContent('meta[property="og:title"]', meta.title);
    setMetaContent('meta[property="og:description"]', desc);
    setMetaContent('meta[name="twitter:title"]', meta.title);
    setMetaContent('meta[name="twitter:description"]', desc);
    setMetaContent('meta[name="robots"]', meta.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1');
    if (CLEAN_URLS) {
      var link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', location.origin + location.pathname.replace(/\/index\.html$/, '/'));
    }
  }

  /* ---------- pages ---------- */
  function pageHome() {
    var pct = updateProgress();
    var cards = C.modules.map(function (m, i) {
      var st = modDone(m) ? '<span class="status done">✓ 已完成</span>' :
        (modStarted(m) ? '<span class="status half">进行中</span>' : '<span class="status muted">未开始</span>');
      return '<a class="card module-card" href="#/m/' + m.id + '"><div class="kicker">模块' + m.no + ' · ' + esc(m.duration) + '</div>' +
        '<h3>' + esc(m.title) + '</h3><p>' + esc(m.goal) + '</p><div class="foot"><span>' + m.sections.length + ' 节讲义' + (hasQuiz(m) ? ' · 小测验' : '') + (hasPractice(m) ? ' · 实践任务' : '') + '</span>' + st + '</div></a>';
    }).join('');
    var next = C.modules.filter(function (m) { return !modDone(m); })[0];
    app.innerHTML = '<div class="wrap">' +
      '<section class="hero"><div class="small" style="opacity:.8">职场AI应用能力课 · 约10—12课时</div><h1>' + esc(C.title) + '</h1>' +
      '<p>' + esc(C.positioning) + '</p>' +
      '<div class="meta">' + C.outcomes.map(function (o) { return '<span class="pill">' + esc(o) + '</span>'; }).join('') + '</div>' +
      '<div class="btn-row" style="margin-top:20px">' +
      (next ? '<a class="btn primary" href="#/m/' + next.id + '">' + (pct ? '继续学习：模块' + next.no : '开始学习') + ' →</a>' : '<span class="pill">全部模块已完成，干得漂亮！</span>') +
      '<a class="btn" href="#/templates">浏览提示词模板库</a></div></section>' +
      '<div class="card"><h2 style="font-size:1.12rem">适合谁</h2><p>' + esc(C.audience) + '</p>' +
      '<h2 style="font-size:1.12rem;margin-top:14px">怎么学</h2><ol class="small" style="padding-left:1.2em;margin:0">' +
      '<li>每个模块都有<b>讲义</b>（含可动手的小练习），大部分模块还配有<b>实践任务</b>；有实践任务的模块需标记完成，有测验的模块需全部答对，这个模块才算完成。</li>' +
      '<li>不确定该用哪类工具时，先看「<b>工具实操</b>」里的三个案例，再回到模块继续学。</li>' +
      '<li>建议手边开着一个你常用的AI对话工具，看到示例提示词就复制过去亲自试一下。</li>' +
      '<li>练习记录、模板收藏都只保存在<b>本浏览器</b>，不会上传到任何地方。不要在练习框里填写真实的敏感信息。</li>' +
      '<li>学完后到「我的模板包」导出一份 Markdown 文件，就是你自己的AI办公工具箱。</li></ol></div>' +
      '<h2 style="margin:28px 0 12px">课程模块</h2><div class="grid two">' + cards + '</div>' +
      '<h2 style="margin:28px 0 12px">工具箱</h2><div class="grid two">' +
      toolCard('#/tools', '工具实操', 'WorkBuddy、对话工具、PPT 工具的三个真实任务，含截图、提示词和验收清单。') +
      toolCard('#/templates', '提示词模板库', '通知、周报、邮件、会议纪要、数据、PPT 等 ' + T.length + ' 条模板，填空即用。') +
      toolCard('#/workshop', '提示词工坊', '按「角色 + 背景 + 任务 + 要求 + 格式」五要素搭建自己的提示词，并实时评估完整度。') +
      toolCard('#/checklist', '输出核验助手', '粘贴AI生成的文字，自动标出需要核对的数字、绝对化表述和敏感信息；配三道关口清单。') +
      toolCard('#/pack', '我的模板包', '收集你收藏和自建的提示词、练习记录，一键导出成 Markdown。') +
      '</div></div>';
  }
  function toolCard(href, t, d) {
    return '<a class="card module-card" href="' + href + '"><h3>' + t + '</h3><p>' + d + '</p></a>';
  }

  function pageModule(id) {
    var idx = -1;
    C.modules.forEach(function (m, i) { if (m.id === id) idx = i; });
    if (idx < 0) return pageNotFound();
    var m = C.modules[idx], s = modState(m.id);
    var toc = m.sections.map(function (sec, i) { return '<button data-jump="sec-' + i + '">' + esc(sec.no + ' ' + sec.title) + '</button>'; }).join('') +
      (hasQuiz(m) ? '<button data-jump="quiz">小测验</button>' : '') + (hasPractice(m) ? '<button data-jump="practice">实践任务</button>' : '');
    var secs = m.sections.map(function (sec, i) {
      return '<section class="card section" id="sec-' + i + '"><h2><span class="sec-no">' + esc(sec.no) + '</span>' + esc(sec.title) + '</h2>' + sec.html + '</section>';
    }).join('');
    var prev = C.modules[idx - 1], next = C.modules[idx + 1];
    app.innerHTML = '<div class="wrap">' +
      '<div class="module-head"><h1>' + esc(m.title) + '</h1><div class="module-meta">模块' + m.no + ' · ' + esc(m.duration) + '</div>' +
      '<div class="goal"><b>学习目标：</b>' + esc(m.goal) + '</div></div>' +
      '<div class="toc">' + toc + '</div>' + secs +
      (hasQuiz(m) ? '<section class="card" id="quiz"><h2>小测验</h2><p class="muted small">点选答案即可看到解析。全部答对后自动记为完成，可以反复作答。</p><div id="quizBox"></div></section>' : '') +
      (hasPractice(m) ? '<section class="card practice" id="practice"><div id="practiceBox"></div></section>' : '') +
      '<div class="pager">' + (prev ? '<a class="btn" href="#/m/' + prev.id + '">← 模块' + prev.no + '：' + esc(prev.short) + '</a>' : '<span></span>') +
      (next ? '<a class="btn primary next" href="#/m/' + next.id + '">模块' + next.no + '：' + esc(next.short) + ' →</a>' : '<a class="btn primary next" href="#/pack">去导出我的模板包 →</a>') + '</div></div>';
    app.querySelector('.toc').addEventListener('click', function (e) {
      var b = e.target.closest('[data-jump]'); if (!b) return;
      var target = document.getElementById(b.getAttribute('data-jump'));
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    mountWidgets(app);
    if (hasQuiz(m)) renderQuiz(m, document.getElementById('quizBox'));
    if (hasPractice(m)) renderPractice(m, document.getElementById('practiceBox'));
  }

  function mountWidgets(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-widget]'), function (el) {
      var name = el.getAttribute('data-widget');
      if (W[name]) {
        el.classList.add('widget');
        try { W[name](el, App); } catch (err) { el.innerHTML = '<p class="muted">组件加载失败：' + esc(err.message) + '</p>'; }
      }
    });
  }

  function renderQuiz(m, box) {
    var key = 'quiz:' + m.id;
    var ans = store.get(key, {});
    function draw() {
      var allRight = m.quiz.every(function (q, qi) { return ans[qi] === q.answer; });
      box.innerHTML = m.quiz.map(function (q, qi) {
        var chosen = ans[qi];
        return '<div class="quiz-q"><div class="q">' + (qi + 1) + '. ' + esc(q.q) + '</div>' +
          q.options.map(function (o, oi) {
            var cls = chosen === oi ? (oi === q.answer ? ' right' : ' wrong') : '';
            return '<button class="quiz-opt' + cls + '" data-q="' + qi + '" data-o="' + oi + '">' + String.fromCharCode(65 + oi) + '. ' + esc(o) + '</button>';
          }).join('') +
          (chosen != null ? '<div class="quiz-exp">' + (chosen === q.answer ? '✓ 回答正确。' : '✗ 再想想。') + esc(q.explain) + '</div>' : '') + '</div>';
      }).join('') + (allRight ? '<div class="done-banner">✓ 小测验已完成</div>' : '') +
        '<div class="btn-row"><button class="btn small ghost" data-reset>重新作答</button></div>';
      if (allRight !== modState(m.id).quiz) setModState(m.id, { quiz: allRight });
    }
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) { ans = {}; store.set(key, ans); draw(); return; }
      var b = e.target.closest('.quiz-opt'); if (!b) return;
      ans[+b.getAttribute('data-q')] = +b.getAttribute('data-o');
      store.set(key, ans); draw();
    });
    draw();
  }

  function renderPractice(m, box) {
    var p = m.practice;
    if (!p || !box) return;
    var key = 'practice:' + m.id;
    var data = store.get(key, { steps: {}, fields: {} });
    var s = modState(m.id);
    var html = '<div class="widget-title">实践任务</div><h2>' + esc(p.title) + '</h2>' + p.intro;
    if (p.steps) {
      html += '<ul class="steps">' + p.steps.map(function (st, i) {
        return '<li><input type="checkbox" id="st' + i + '" data-step="' + i + '"' + (data.steps[i] ? ' checked' : '') + '><label for="st' + i + '">' + st + '</label></li>';
      }).join('') + '</ul>';
    }
    if (p.widget) html += '<div data-widget="' + p.widget + '"></div>';
    (p.fields || []).forEach(function (f) {
      var fieldId = 'practice-' + m.id + '-' + f.id;
      html += '<div class="field"><label' + (f.type === 'table' ? '' : ' for="' + fieldId + '"') + '>' + esc(f.label) + '</label>' + (f.hint ? '<div class="hint" id="' + fieldId + '-hint">' + esc(f.hint) + '</div>' : '');
      if (f.type === 'table') {
        html += '<div class="table-scroll"><table class="t"><thead><tr><th></th>' + f.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          f.rows.map(function (r, ri) {
            return '<tr><th>' + esc(r) + '</th>' + f.cols.map(function (c, ci) {
              var k = f.id + ':' + ri + ':' + ci;
              return '<td><textarea class="cell-input" data-field="' + k + '" aria-label="' + esc(r + ' - ' + c) + '">' + esc(data.fields[k] || '') + '</textarea></td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        html += '<textarea id="' + fieldId + '"' + (f.hint ? ' aria-describedby="' + fieldId + '-hint"' : '') + ' data-field="' + f.id + '" placeholder="' + esc(f.placeholder || '') + '" style="min-height:' + (f.rows ? f.rows * 28 : 100) + 'px">' + esc(data.fields[f.id] || '') + '</textarea>';
      }
      html += '</div>';
    });
    html += '<div class="btn-row"><button class="btn primary" data-done>' + (s.practice ? '✓ 已完成（点击取消）' : '标记为已完成') + '</button>' +
      '<button class="btn" data-topack>把练习记录加入模板包</button><span class="saved-note" id="savedNote">输入内容会自动保存在本浏览器</span></div>';
    box.innerHTML = html;
    mountWidgets(box);
    var t;
    box.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-field'); if (!k) return;
      data.fields[k] = e.target.value;
      clearTimeout(t);
      t = setTimeout(function () { store.set(key, data); var n = document.getElementById('savedNote'); if (n) n.textContent = '已自动保存 ' + new Date().toLocaleTimeString('zh-CN'); }, 300);
    });
    box.addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-step'); if (i == null) return;
      data.steps[i] = e.target.checked; store.set(key, data);
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-done]')) {
        var now = !modState(m.id).practice;
        setModState(m.id, { practice: now });
        e.target.closest('[data-done]').textContent = now ? '✓ 已完成（点击取消）' : '标记为已完成';
        toast(now ? '实践任务已完成' : '已取消完成标记');
      }
      if (e.target.closest('[data-topack]')) {
        var body = practiceToMarkdown(m, data);
        if (!body.trim()) { toast('练习记录还是空的'); return; }
        addToPack({ kind: 'note', title: '模块' + m.no + '练习：' + p.title, body: body });
      }
    });
  }

  function practiceToMarkdown(m, data) {
    var p = m.practice;
    if (!p) return '';
    data = data || { fields: {} };
    var out = [];
    (p.fields || []).forEach(function (f) {
      if (f.type === 'table') {
        var rows = f.rows.map(function (r, ri) {
          var cells = f.cols.map(function (c, ci) { return (data.fields[f.id + ':' + ri + ':' + ci] || '').replace(/\n/g, ' ').replace(/\|/g, '/'); });
          return cells.some(Boolean) ? '| ' + r + ' | ' + cells.join(' | ') + ' |' : null;
        }).filter(Boolean);
        if (rows.length) out.push('**' + f.label + '**\n\n| | ' + f.cols.join(' | ') + ' |\n|' + f.cols.map(function () { return '---'; }).join('|') + '|---|\n' + rows.join('\n'));
      } else if (data.fields[f.id]) {
        out.push('**' + f.label + '**\n\n' + data.fields[f.id]);
      }
    });
    return out.join('\n\n');
  }

  function learningStats() {
    var pack = store.get('pack', []);
    var done = 0, next = null;
    C.modules.forEach(function (m) {
      if (modDone(m)) done++;
      else if (!next) next = m;
    });
    var practices = 0, practiceTotal = 0;
    C.modules.forEach(function (m) {
      if (!hasPractice(m)) return;
      practiceTotal++;
      var data = store.get('practice:' + m.id, { fields: {} });
      if (practiceToMarkdown(m, data).trim()) practices++;
    });
    return {
      done: done,
      total: C.modules.length,
      pct: Math.round(done / C.modules.length * 100),
      packCount: pack.length,
      prompts: pack.filter(function (p) { return p.kind === 'prompt'; }).length,
      practices: practices,
      practiceTotal: practiceTotal,
      next: next ? { id: next.id, no: next.no, short: next.short } : null
    };
  }

  /* ---------- tools ---------- */
  function pageTools() {
    var data = C.toolCases;
    if (!data) return pageNotFound();
    var cases = data.cases.map(function (c) {
      var meta = c.meta.map(function (m) {
        return '<span class="case-meta-item"><b>' + esc(m.k) + '</b>' + esc(m.v) + '</span>';
      }).join('');
      return '<section class="card case" id="' + esc(c.id) + '">' +
        '<div class="case-kicker">' + esc(c.kicker) + '</div>' +
        '<h2>' + esc(c.title) + '</h2>' +
        '<p class="case-lead">' + esc(c.lead) + '</p>' +
        '<div class="case-meta">' + meta + '</div>' +
        fixAssets(c.body) + '</section>';
    }).join('');
    var rows = data.choose.map(function (r) {
      return '<tr><td>' + esc(r.need) + '</td><td><b>' + esc(r.tool) + '</b></td><td>' + esc(r.why) + '</td><td>' + esc(r.eg) + '</td></tr>';
    }).join('');
    app.innerHTML = '<div class="wrap">' +
      '<div class="module-head"><h1>' + esc(data.title) + '</h1>' +
      '<p class="muted">' + esc(data.intro) + '</p></div>' +
      '<div class="callout tip small">' + esc(data.shotNote) + '</div>' +
      cases +
      '<section class="card"><h2>三个案例怎么选</h2>' +
      '<div class="table-scroll"><table class="t">' +
      '<tr><th>你的任务长什么样</th><th style="width:18%">优先用</th><th>为什么</th><th style="width:16%">对应案例</th></tr>' +
      rows + '</table></div>' +
      '<p class="small muted">判断顺序：先看任务要几步、要不要碰文件；再看是否需要排版。工具可以换，判断顺序不用换。</p>' +
      '<div class="btn-row"><a class="btn" href="#/m/m1">← 回到模块一：工具分工</a>' +
      '<a class="btn primary" href="#/templates">去模板库挑一条提示词 →</a></div></section>' +
      '</div>';
    normalizeLinks(app);
  }

  /* ---------- templates ---------- */
  function varsOf(body) {
    var seen = {}, list = [], re = /\{\{([^}]+)\}\}/g, mm;
    while ((mm = re.exec(body))) { if (!seen[mm[1]]) { seen[mm[1]] = 1; list.push(mm[1]); } }
    return list;
  }
  function fillTpl(body, vals, asHtml) {
    if (!asHtml) return body.replace(/\{\{([^}]+)\}\}/g, function (_, k) { return vals[k] ? vals[k] : '【' + k + '】'; });
    return body.split(/(\{\{[^}]+\}\})/).map(function (part) {
      var mm = part.match(/^\{\{([^}]+)\}\}$/);
      if (!mm) return esc(part);
      return vals[mm[1]] ? '<span class="var-hl">' + esc(vals[mm[1]]) + '</span>' : '<span class="var-empty">【' + esc(mm[1]) + '】</span>';
    }).join('');
  }

  function pageTemplates(selId) {
    var cats = ['全部'].concat(T.map(function (t) { return t.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var cat = store.get('tplCat', '全部'), q = '';
    if (cat !== '全部' && cats.indexOf(cat) < 0) cat = '全部';
    var sel = selId ? T.filter(function (t) { return t.id === selId; })[0] : null;
    var heading = sel ? sel.title + '提示词模板' : '提示词模板库';
    app.innerHTML = '<div class="wrap" style="max-width:1100px"><h1>' + esc(heading) + '</h1>' +
      '<p class="muted">每条模板都按「角色 + 背景 + 任务 + 要求 + 格式」组织。选中模板 → 填写右侧的【变量】→ 复制到AI工具使用。没填的变量会保留为【方括号】，方便你在AI工具里再补。</p>' +
      '<div class="btn-row" style="margin-bottom:14px"><input type="text" class="search" id="tplSearch" placeholder="搜索模板，如：周报、邮件、纪要"></div>' +
      '<div id="tplCats" style="margin-bottom:14px"></div>' +
      '<div class="two-col"><div class="tpl-list" id="tplList"></div><div class="sticky" id="tplDetail"></div></div></div>';
    var listEl = document.getElementById('tplList'), detailEl = document.getElementById('tplDetail'), catsEl = document.getElementById('tplCats');
    function drawCats() {
      catsEl.innerHTML = cats.map(function (c) { return '<button class="chip' + (c === cat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    }
    function drawList() {
      var items = T.filter(function (t) {
        return (cat === '全部' || t.cat === cat) && (!q || (t.title + t.scene + t.cat + t.body).indexOf(q) >= 0);
      });
      listEl.style.gridTemplateColumns = '1fr';
      listEl.innerHTML = items.length ? items.map(function (t) {
        return '<button class="tpl-item' + (sel && sel.id === t.id ? ' on' : '') + '" data-id="' + t.id + '"><div class="t2">' + esc(t.cat) + ' · ' + esc(t.mode) + '</div><div class="t1">' + esc(t.title) + '</div><div class="t2">' + esc(t.scene) + '</div></button>';
      }).join('') : '<div class="empty">没有找到匹配的模板。</div>';
    }
    function drawDetail() {
      if (!sel) { detailEl.innerHTML = '<div class="card"><p class="muted">← 从左侧选择一条模板。</p></div>'; return; }
      var vals = store.get('tplVals:' + sel.id, {});
      var vars = varsOf(sel.body);
      detailEl.innerHTML = '<div class="card"><div class="small muted">' + esc(sel.cat) + ' · ' + esc(sel.mode) + (sel.module ? ' · 对应<a href="#/m/' + sel.module + '">模块' + moduleNo(sel.module) + '</a>' : '') + '</div>' +
        '<h2>' + esc(sel.title) + '</h2><p class="small">' + esc(sel.scene) + '</p>' +
        vars.map(function (v) {
          var hint = (sel.hints && sel.hints[v]) || '';
          return '<div class="field" style="margin:8px 0"><label>' + esc(v) + '</label>' +
            '<textarea data-var="' + esc(v) + '" placeholder="' + esc(hint) + '" rows="1" style="min-height:' +
            (hint.length > 40 || /内容|清单|材料|素材|文本|数据|要点|原文|记录|情况/.test(v) ? '70px' : '40px') + '">' + esc(vals[v] || '') + '</textarea></div>';
        }).join('') +
        '<div class="sample-label" style="margin-top:12px">生成的提示词</div><div class="prompt-box" id="tplOut"></div>' +
        (sel.note ? '<div class="callout tip small"><b>使用提示</b>' + esc(sel.note) + '</div>' : '') +
        '<div class="btn-row"><button class="btn primary" data-copy>复制提示词</button><button class="btn" data-save>加入我的模板包</button><button class="btn" data-share>分享模板</button><button class="btn ghost" data-clear>清空填写</button></div></div>';
      var out = document.getElementById('tplOut');
      function upd() { out.innerHTML = fillTpl(sel.body, vals, true); }
      upd();
      detailEl.oninput = function (e) {
        var v = e.target.getAttribute('data-var'); if (!v) return;
        vals[v] = e.target.value; store.set('tplVals:' + sel.id, vals); upd();
      };
      detailEl.onclick = function (e) {
        if (e.target.closest('[data-copy]')) copy(fillTpl(sel.body, vals, false));
        if (e.target.closest('[data-save]')) addToPack({ kind: 'prompt', title: sel.title, body: sel.body, note: sel.scene });
        if (e.target.closest('[data-share]') && window.SHARE) window.SHARE.openTemplateShare(sel);
        if (e.target.closest('[data-clear]')) { vals = {}; store.del('tplVals:' + sel.id); drawDetail(); }
      };
      normalizeLinks(detailEl);
    }
    catsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      cat = b.getAttribute('data-cat'); store.set('tplCat', cat); drawCats(); drawList();
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      sel = T.filter(function (t) { return t.id === b.getAttribute('data-id'); })[0];
      var tplRoute = '/templates/' + sel.id;
      history.replaceState(null, '', CLEAN_URLS ? hrefFor(tplRoute) : '#' + tplRoute);
      applySeo(SEO.pageMeta(['templates', sel.id], C, T));
      var heading = app.querySelector('h1');
      if (heading) heading.textContent = sel.title + '提示词模板';
      drawList(); drawDetail();
      if (window.innerWidth <= 960) detailEl.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('tplSearch').addEventListener('input', function () { q = this.value.trim(); drawList(); });
    drawCats(); drawList(); drawDetail();
  }
  function moduleNo(id) { var m = C.modules.filter(function (x) { return x.id === id; })[0]; return m ? m.no : ''; }

  /* ---------- workshop ---------- */
  function pageWorkshop() {
    app.innerHTML = '<div class="wrap" style="max-width:1100px"><h1>提示词工坊</h1>' +
      '<p class="muted">按五要素填写，右侧实时拼出完整提示词，并给出完整度评估。写好的提示词可以存进「我的模板包」反复用。用 <code>{{变量名}}</code> 标出每次会变化的部分，它就成了一条模板。</p>' +
      '<div data-widget="workshop"></div></div>';
    mountWidgets(app);
  }

  /* ---------- checklist ---------- */
  function pageChecklist() {
    app.innerHTML = '<div class="wrap"><h1>输出核验助手</h1>' +
      '<p class="muted">AI 写得再顺，也要过「事实 → 逻辑 → 合规」三道关口才能用。把AI生成的文字粘贴到下面，助手会用规则标出值得重点核对的位置（只是提醒，不做判断），再对照清单逐项确认。</p>' +
      '<div data-widget="highlighter"></div><div data-widget="gates"></div></div>';
    mountWidgets(app);
  }

  /* ---------- pack ---------- */
  function pageNotFound() {
    app.innerHTML = '<div class="wrap"><div class="card"><h1>没有找到这个页面</h1><p><a href="#/">返回课程首页</a></p></div></div>';
  }

  function pagePack() {
    app.innerHTML = '<div class="wrap"><h1>我的模板包</h1>' +
      '<p class="muted">模块五提到的「个人AI办公模板包」就在这里积累：你从模板库收藏的、在工坊里自建的提示词，以及各模块的练习记录。导出成 Markdown 后，可以放进笔记软件、团队文档，或者设成输入法的快捷短语。</p>' +
      '<div class="card"><h2 style="font-size:1.12rem">把成果分享出去</h2>' +
      '<p>生成一张带学习进度和课程二维码的卡片，发给同事或学习群。模板库里的每一条模板也可以单独生成分享卡片。</p>' +
      '<div class="btn-row"><button class="btn primary" data-share-card>生成学习成果卡</button><button class="btn" data-share-course>推荐这门课</button></div>' +
      '<p class="small muted" style="margin:10px 0 0">图片在本机生成，不会上传；卡片上的二维码指向课程或模板页面。</p></div>' +
      '<div data-widget="pack"></div></div>';
    mountWidgets(app);
  }

  /* ---------- router ---------- */
  function route() {
    var hash = location.hash.indexOf('#/') === 0 ? location.hash.slice(1) : '';
    if (hash && CLEAN_URLS) location.replace(hrefFor(hash));
    var path = hash || PAGE_ROUTE || '/';
    currentRoute = path;
    var parts = path.split('/').filter(Boolean);
    if (!parts.length) pageHome();
    else if (parts[0] === 'm') pageModule(parts[1]);
    else if (parts[0] === 'tools') pageTools();
    else if (parts[0] === 'templates') pageTemplates(parts[1]);
    else if (parts[0] === 'workshop') pageWorkshop();
    else if (parts[0] === 'checklist') pageChecklist();
    else if (parts[0] === 'pack') pagePack();
    else pageNotFound();
    updateProgress();
    applySeo(SEO.pageMeta(parts, C, T));
    normalizeLinks(document);
    var anchor = location.hash && location.hash.indexOf('#/') !== 0 ? location.hash.slice(1) : '';
    var anchorTarget = anchor ? document.getElementById(anchor) : null;
    if (anchorTarget) anchorTarget.scrollIntoView();
    else window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  var App = {
    store: store, esc: esc, toast: toast, copy: copy, addToPack: addToPack,
    varsOf: varsOf, fillTpl: fillTpl, practiceToMarkdown: practiceToMarkdown, learningStats: learningStats,
    course: C, templates: T, modState: modState
  };
  window.App = App;
  window.addEventListener('hashchange', route);
  route();
})();
