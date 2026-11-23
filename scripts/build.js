#!/usr/bin/env node
'use strict';

/*
 * 静态页面生成器（零依赖）。
 *
 *   node scripts/build.js
 *   SITE_URL=https://example.com/ai-work node scripts/build.js
 *
 * 内容来源仍然是 assets/content.js 与 assets/templates.js。
 * 运行后会生成 index.html、m/<模块>/index.html、tools/index.html、templates/<模板>/index.html、
 * workshop/index.html、checklist/index.html 和 pack/index.html。
 * 设置 SITE_URL 后还会生成 sitemap.xml，并在 robots.txt 中写入 Sitemap。
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var SEO = require('../assets/seo.js');

var ROOT = path.resolve(__dirname, '..');
var SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (SITE_URL && !/^https?:\/\//i.test(SITE_URL)) {
  throw new Error('SITE_URL 必须是完整的 http(s) 地址，例如 https://example.com/ai-work');
}
var DEFAULT_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1';

/* ---------- 数据 ---------- */
function loadCourseData() {
  var context = { window: {} };
  vm.createContext(context);
  ['assets/content.js', 'assets/templates.js'].forEach(function (file) {
    var source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  if (!context.window.COURSE || !context.window.TEMPLATES) {
    throw new Error('无法读取 COURSE 或 TEMPLATES，请检查 assets/content.js 与 assets/templates.js。');
  }
  return { C: context.window.COURSE, T: context.window.TEMPLATES };
}

var data = loadCourseData();
var C = data.C;
var T = data.T;

/* ---------- 文案与工具 ---------- */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function hasQuiz(m) { return !!(m.quiz && m.quiz.length); }
function hasPractice(m) { return !!m.practice; }
function relFor(route) {
  if (route === '/') return './';
  return '../'.repeat(route.split('/').filter(Boolean).length);
}
function hrefFor(route, rel) {
  if (route === '/') return rel;
  return rel + route.replace(/^\//, '').replace(/\/+$/, '') + '/';
}
function absolute(route) {
  if (!SITE_URL) return null;
  var base = SITE_URL + '/';
  return new URL(route === '/' ? './' : route.replace(/^\//, '') + '/', base).href;
}
function canonicalFor(route) {
  return absolute(route) || './';
}
function ogImageFor(rel) {
  if (SITE_URL) return new URL('assets/og.png', SITE_URL + '/').href;
  return rel + 'assets/og.png';
}
function link(route, rel, inner, attrs) {
  return '<a href="' + hrefFor(route, rel) + '" data-route="' + route + '"' +
    (attrs ? ' ' + attrs : '') + '>' + inner + '</a>';
}
function fixLinks(html, rel) {
  return String(html == null ? '' : html).replace(/href="#\/([^"]*)"/g, function (_, rest) {
    var route = '/' + rest.replace(/\/+$/, '');
    return 'href="' + hrefFor(route, rel) + '" data-route="' + route + '"';
  });
}
function fixAssets(html, rel) {
  return String(html == null ? '' : html).replace(/(src|poster|href)="assets\//g, '$1="' + rel + 'assets/');
}
function metaFor(route) {
  return SEO.pageMeta(route.split('/').filter(Boolean), C, T);
}
function varsOf(body) {
  var seen = {};
  var list = [];
  var re = /\{\{([^}]+)\}\}/g;
  var match;
  while ((match = re.exec(body))) {
    if (!seen[match[1]]) {
      seen[match[1]] = true;
      list.push(match[1]);
    }
  }
  return list;
}

/* ---------- JSON-LD ---------- */
function homeJsonLd(meta) {
  var course = {
    '@type': 'Course',
    name: SEO.SITE_NAME,
    description: meta.desc,
    inLanguage: 'zh-Hans',
    isAccessibleForFree: true,
    educationalLevel: '初级',
    coursePrerequisites: '无需AI基础；适合经常处理文字、数据与汇报材料的职场人。',
    teaches: C.outcomes,
    audience: { '@type': 'Audience', audienceType: '中国职场人' },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT10H' },
    syllabusSections: C.modules.map(function (m) {
      return {
        '@type': 'Syllabus',
        name: '模块' + m.no + '：' + m.title,
        description: m.goal
      };
    })
  };
  if (absolute('/')) course.url = absolute('/');

  var website = {
    '@type': 'WebSite',
    name: SEO.SITE_NAME,
    inLanguage: 'zh-Hans',
    description: '面向中国职场人的交互式AI办公课程，含课程模块、提示词模板、输出核验助手与模板包导出。'
  };
  if (absolute('/')) website.url = absolute('/');

  return { '@context': 'https://schema.org', '@graph': [course, website] };
}
function moduleJsonLd(m) {
  var item = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: m.title,
    description: m.goal,
    inLanguage: 'zh-Hans',
    learningResourceType: '课程模块',
    isAccessibleForFree: true,
    isPartOf: { '@type': 'Course', name: SEO.SITE_NAME }
  };
  if (absolute('/m/' + m.id)) item.url = absolute('/m/' + m.id);
  return item;
}
function toolsJsonLd(meta) {
  var item = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: C.toolCases.title,
    description: meta.desc,
    inLanguage: 'zh-Hans',
    learningResourceType: '工具实操',
    isAccessibleForFree: true,
    isPartOf: { '@type': 'Course', name: SEO.SITE_NAME }
  };
  if (absolute('/tools')) item.url = absolute('/tools');
  return item;
}
function templateJsonLd(t, meta) {
  var item = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: t.title + '提示词模板',
    description: meta.desc,
    inLanguage: 'zh-Hans',
    learningResourceType: '提示词模板',
    about: t.cat,
    isAccessibleForFree: true,
    isPartOf: { '@type': 'Course', name: SEO.SITE_NAME }
  };
  if (absolute('/templates/' + t.id)) item.url = absolute('/templates/' + t.id);
  return item;
}
function toolJsonLd(tool, meta) {
  var item = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.name,
    description: meta.desc,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'zh-Hans',
    isAccessibleForFree: true
  };
  if (absolute('/' + tool.id)) item.url = absolute('/' + tool.id);
  return item;
}
function collectionJsonLd(meta) {
  var item = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '提示词模板库',
    description: meta.desc,
    inLanguage: 'zh-Hans',
    isPartOf: { '@type': 'WebSite', name: SEO.SITE_NAME }
  };
  if (absolute('/templates')) item.url = absolute('/templates');
  return item;
}

/* ---------- 页面片段 ---------- */
function renderSidebar(rel, active) {
  function nav(route, inner, isActive) {
    return '<a href="' + hrefFor(route, rel) + '" data-route="' + route + '"' +
      (isActive ? ' class="active" aria-current="page"' : '') + '>' + inner + '</a>';
  }
  var html = nav('/', '<span class="ico">⌂</span>课程首页', active === '/') + '<h4>课程模块</h4>';
  C.modules.forEach(function (m, i) {
    html += nav('/m/' + m.id, '<span class="num">' + (i + 1) + '</span>' + esc(m.short), active === '/m/' + m.id);
  });
  html += '<h4>工具箱</h4>' +
    nav('/tools', '<span class="ico">▸</span>工具实操', active === '/tools') +
    nav('/templates', '<span class="ico">▤</span>提示词模板库', active === '/templates') +
    nav('/workshop', '<span class="ico">✎</span>提示词工坊', active === '/workshop') +
    nav('/checklist', '<span class="ico">☑</span>输出核验助手', active === '/checklist') +
    nav('/pack', '<span class="ico">★</span>我的模板包', active === '/pack');
  return html;
}

function renderHome(rel) {
  var first = C.modules[0];
  var cards = C.modules.map(function (m) {
    return '<a class="card module-card" href="' + hrefFor('/m/' + m.id, rel) + '" data-route="/m/' + m.id + '">' +
      '<div class="kicker">模块' + esc(m.no) + ' · ' + esc(m.duration) + '</div>' +
      '<h3>' + esc(m.title) + '</h3><p>' + esc(m.goal) + '</p>' +
      '<div class="foot"><span>' + m.sections.length + ' 节讲义' +
      (hasQuiz(m) ? ' · 小测验' : '') + (hasPractice(m) ? ' · 实践任务' : '') + '</span></div></a>';
  }).join('');

  function toolCard(route, title, desc) {
    return link(route, rel, '<h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p>', 'class="card module-card"');
  }

  return '<div class="wrap">' +
    '<section class="hero"><div class="small" style="opacity:.8">职场AI应用能力课 · 约10—12课时</div>' +
    '<h1>' + esc(C.title) + '</h1><p>' + esc(C.positioning) + '</p>' +
    '<div class="meta">' + C.outcomes.map(function (o) { return '<span class="pill">' + esc(o) + '</span>'; }).join('') + '</div>' +
    '<div class="btn-row" style="margin-top:20px">' +
    link('/m/' + first.id, rel, '开始学习 →', 'class="btn primary"') +
    link('/templates', rel, '浏览提示词模板库', 'class="btn"') + '</div></section>' +
    '<div class="card"><h2 style="font-size:1.12rem">适合谁</h2><p>' + esc(C.audience) + '</p>' +
    '<h2 style="font-size:1.12rem;margin-top:14px">怎么学</h2><ol class="small" style="padding-left:1.2em;margin:0">' +
    '<li>每个模块都有<b>讲义</b>（含可动手的小练习），大部分模块还配有<b>实践任务</b>；有实践任务的模块需标记完成，有测验的模块需全部答对，这个模块才算完成。</li>' +
    '<li>不确定该用哪类工具时，先看「<b>工具实操</b>」里的三个案例，再回到模块继续学。</li>' +
    '<li>建议手边开着一个你常用的AI对话工具，看到示例提示词就复制过去亲自试一下。</li>' +
    '<li>练习记录、模板收藏都只保存在<b>本浏览器</b>，不会上传到任何地方。不要在练习框里填写真实的敏感信息。</li>' +
    '<li>学完后到「我的模板包」导出一份 Markdown 文件，就是你自己的AI办公工具箱。</li></ol></div>' +
    '<h2 style="margin:28px 0 12px">课程模块</h2><div class="grid two">' + cards + '</div>' +
    '<h2 style="margin:28px 0 12px">工具箱</h2><div class="grid two">' +
    toolCard('/tools', '工具实操', 'WorkBuddy、对话工具、PPT 工具的三个真实任务，含截图、提示词和验收清单。') +
    toolCard('/templates', '提示词模板库', '通知、周报、邮件、会议纪要、数据、PPT 等 ' + T.length + ' 条模板，填空即用。') +
    toolCard('/workshop', '提示词工坊', '按「角色 + 背景 + 任务 + 要求 + 格式」五要素搭建自己的提示词，并实时评估完整度。') +
    toolCard('/checklist', '输出核验助手', '粘贴AI生成的文字，自动标出需要核对的数字、绝对化表述和敏感信息；配三道关口清单。') +
    toolCard('/pack', '我的模板包', '收集你收藏和自建的提示词、练习记录，一键导出成 Markdown。') +
    '</div></div>';
}

function renderModule(m, rel) {
  var idx = C.modules.indexOf(m);
  var toc = m.sections.map(function (sec, i) {
    return '<a href="#sec-' + i + '">' + esc(sec.no + ' ' + sec.title) + '</a>';
  }).join('') +
    (hasQuiz(m) ? '<a href="#quiz">小测验</a>' : '') +
    (hasPractice(m) ? '<a href="#practice">实践任务</a>' : '');

  var sections = m.sections.map(function (sec, i) {
    return '<section class="card section" id="sec-' + i + '">' +
      '<h2><span class="sec-no">' + esc(sec.no) + '</span>' + esc(sec.title) + '</h2>' +
      fixLinks(sec.html, rel) + '</section>';
  }).join('');

  var quiz = '';
  if (hasQuiz(m)) {
    quiz = '<section class="card" id="quiz"><h2>小测验</h2>' +
      '<p class="muted small">启用 JavaScript 后可作答并查看解析。下面是题目预览。</p><ol>' +
      m.quiz.map(function (q) {
        return '<li><div>' + esc(q.q) + '</div><ul>' +
          q.options.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul></li>';
      }).join('') + '</ol></section>';
  }

  var practice = '';
  if (hasPractice(m)) {
    var p = m.practice;
    practice = '<section class="card practice" id="practice"><div class="widget-title">实践任务</div>' +
      '<h2>' + esc(p.title) + '</h2>' + fixLinks(p.intro, rel) +
      (p.steps && p.steps.length ? '<ol class="small">' + p.steps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>' : '') +
      '<p class="muted small">启用 JavaScript 后可填写并保存练习记录，并加入「我的模板包」。</p></section>';
  }

  var prev = C.modules[idx - 1];
  var next = C.modules[idx + 1];
  var pager = '<div class="pager">' +
    (prev ? link('/m/' + prev.id, rel, '← 模块' + prev.no + '：' + esc(prev.short), 'class="btn"') : '<span></span>') +
    (next ? link('/m/' + next.id, rel, '模块' + next.no + '：' + esc(next.short) + ' →', 'class="btn primary next"') :
      link('/pack', rel, '去导出我的模板包 →', 'class="btn primary next"')) + '</div>';

  return '<div class="wrap">' +
    '<div class="module-head"><h1>' + esc(m.title) + '</h1>' +
    '<div class="module-meta">模块' + esc(m.no) + ' · ' + esc(m.duration) + '</div>' +
    '<div class="goal"><b>学习目标：</b>' + esc(m.goal) + '</div></div>' +
    '<div class="toc">' + toc + '</div>' + sections + quiz + practice + pager + '</div>';
}

function renderTools(rel) {
  var data = C.toolCases;
  var cases = data.cases.map(function (c) {
    var meta = c.meta.map(function (m) {
      return '<span class="case-meta-item"><b>' + esc(m.k) + '</b>' + esc(m.v) + '</span>';
    }).join('');
    return '<section class="card case" id="' + esc(c.id) + '">' +
      '<div class="case-kicker">' + esc(c.kicker) + '</div>' +
      '<h2>' + esc(c.title) + '</h2>' +
      '<p class="case-lead">' + esc(c.lead) + '</p>' +
      '<div class="case-meta">' + meta + '</div>' +
      fixAssets(fixLinks(c.body, rel), rel) +
      '</section>';
  }).join('');
  var rows = data.choose.map(function (r) {
    return '<tr><td>' + esc(r.need) + '</td><td><b>' + esc(r.tool) + '</b></td><td>' + esc(r.why) + '</td><td>' + esc(r.eg) + '</td></tr>';
  }).join('');
  return '<div class="wrap">' +
    '<div class="module-head"><h1>' + esc(data.title) + '</h1>' +
    '<p class="muted">' + esc(data.intro) + '</p></div>' +
    '<div class="callout tip small">' + esc(data.shotNote) + '</div>' +
    cases +
    '<section class="card"><h2>三个案例怎么选</h2>' +
    '<div class="table-scroll"><table class="t">' +
    '<tr><th>你的任务长什么样</th><th style="width:18%">优先用</th><th>为什么</th><th style="width:16%">对应案例</th></tr>' +
    rows + '</table></div>' +
    '<p class="small muted">判断顺序：先看任务要几步、要不要碰文件；再看是否需要排版。工具可以换，判断顺序不用换。</p>' +
    '<div class="btn-row">' + link('/m/m1', rel, '← 回到模块一：工具分工', 'class="btn"') +
    link('/templates', rel, '去模板库挑一条提示词 →', 'class="btn primary"') + '</div></section>' +
    '</div>';
}

function renderTemplatesIndex(rel) {
  var items = T.map(function (t) {
    return '<a class="tpl-item" href="' + hrefFor('/templates/' + t.id, rel) + '" data-route="/templates/' + t.id + '">' +
      '<div class="t2">' + esc(t.cat) + ' · ' + esc(t.mode) + '</div>' +
      '<div class="t1">' + esc(t.title) + '</div>' +
      '<div class="t2">' + esc(t.scene) + '</div></a>';
  }).join('');
  return '<div class="wrap" style="max-width:1100px"><h1>提示词模板库</h1>' +
    '<p class="muted">每条模板都按「角色 + 背景 + 任务 + 要求 + 格式」组织。共 ' + T.length + ' 条，覆盖通知、邮件、周报、汇报、会议纪要、数据与PPT等场景。</p>' +
    '<p class="small muted">启用 JavaScript 后可按关键词搜索、按分类筛选，并在页面上填写变量、一键复制。</p>' +
    '<div class="tpl-list">' + items + '</div>' +
    '<p style="margin-top:20px">' + link('/workshop', rel, '不会套模板？到提示词工坊自己搭一条 →', 'class="btn"') + '</p></div>';
}

function renderTemplate(t, rel) {
  var vars = varsOf(t.body);
  var moduleLink = t.module ? link('/m/' + t.module, rel, '模块' + moduleNo(t.module)) : '';
  return '<div class="wrap">' +
    '<p class="small">' + link('/templates', rel, '← 返回提示词模板库') + '</p>' +
    '<div class="card"><div class="small muted">' + esc(t.cat) + ' · ' + esc(t.mode) +
    (moduleLink ? ' · 对应' + moduleLink : '') + '</div>' +
    '<h1>' + esc(t.title) + '提示词模板</h1>' +
    '<p class="small">' + esc(t.scene) + '</p>' +
    (vars.length ? '<div class="sample-label" style="margin-top:12px">可填写的变量</div><p class="small muted">' + vars.map(esc).join('、') + '</p>' : '') +
    '<div class="sample-label" style="margin-top:12px">完整提示词</div>' +
    '<pre class="prompt-box">' + esc(t.body) + '</pre>' +
    (t.note ? '<div class="callout tip small"><b>使用提示</b>' + esc(t.note) + '</div>' : '') +
    '<p class="small muted">启用 JavaScript 后可直接在页面填写变量、复制提示词，或加入「我的模板包」。</p></div>' +
    '<p class="small"><a href="' + hrefFor('/templates', rel) + '" data-route="/templates">浏览其他模板 →</a></p></div>';
}

function renderTool(tool, rel) {
  var meta = metaFor('/' + tool.id);
  var extra = tool.id === 'checklist'
    ? '<p>三道关口：<b>事实核验</b> → <b>逻辑核验</b> → <b>合规核验</b>。</p>'
    : '';
  return '<div class="wrap"><h1>' + esc(tool.name) + '</h1><p class="muted">' + esc(meta.desc) + '</p>' +
    '<div class="card"><p>此工具依赖 JavaScript 提供交互功能。请在浏览器中启用 JavaScript 后使用。</p>' + extra +
    '<p>' + link('/', rel, '返回课程首页', 'class="btn"') + '</p></div></div>';
}

function moduleNo(id) {
  for (var i = 0; i < C.modules.length; i++) if (C.modules[i].id === id) return C.modules[i].no;
  return '';
}

/* ---------- 页面外壳 ---------- */
function shell(page) {
  var rel = relFor(page.route);
  var canonical = page.canonical === null ? '' : '<link rel="canonical" href="' + esc(page.canonical) + '">';
  var ogUrl = page.canonical && SITE_URL ? '<meta property="og:url" content="' + esc(page.canonical) + '">' : '';
  var jsonLd = page.jsonLd ? '<script type="application/ld+json">\n' + JSON.stringify(page.jsonLd, null, 2) + '\n</script>' : '';
  return '<!doctype html>\n' +
    '<!-- 由 scripts/build.js 从 assets/content.js 与 assets/templates.js 生成，请勿直接编辑。 -->\n' +
    '<html lang="zh-Hans">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="scripts/build.js">\n' +
    '<title>' + esc(page.meta.title) + '</title>\n' +
    '<meta name="description" content="' + esc(page.meta.desc) + '">\n' +
    '<meta name="robots" content="' + esc(page.robots || DEFAULT_ROBOTS) + '">\n' +
    '<meta name="theme-color" content="#0f766e">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:locale" content="zh_CN">\n' +
    '<meta property="og:site_name" content="' + esc(SEO.SITE_NAME) + '">\n' +
    '<meta property="og:title" content="' + esc(page.meta.title) + '">\n' +
    '<meta property="og:description" content="' + esc(page.meta.desc) + '">\n' +
    (ogUrl ? ogUrl + '\n' : '') +
    '<meta property="og:image" content="' + esc(ogImageFor(rel)) + '">\n' +
    '<meta property="og:image:width" content="1200">\n' +
    '<meta property="og:image:height" content="630">\n' +
    '<meta property="og:image:alt" content="AI办公与写作实战：AI 写初稿，人来签字">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(page.meta.title) + '">\n' +
    '<meta name="twitter:description" content="' + esc(page.meta.desc) + '">\n' +
    '<meta name="twitter:image" content="' + esc(ogImageFor(rel)) + '">\n' +
    '<link rel="icon" href="' + rel + 'assets/favicon.svg" type="image/svg+xml">\n' +
    (canonical ? canonical + '\n' : '') +
    '<link rel="stylesheet" href="' + rel + 'assets/style.css">\n' +
    (jsonLd ? jsonLd + '\n' : '') +
    '</head>\n<body data-route="' + page.route + '" data-root="' + rel + '">\n' +
    '<header class="topbar">\n' +
    '  <button class="menu-btn" id="menuBtn" aria-label="打开目录" aria-expanded="false">☰</button>\n' +
    '  ' + link('/', rel, 'AI办公与写作实战', 'class="brand"') + '\n' +
    '  <div class="topbar-progress" title="课程进度"><span id="topProgressText">0%</span><div class="bar"><i id="topProgressBar"></i></div></div>\n' +
    '</header>\n' +
    '<div class="layout">\n' +
    '  <nav class="sidebar" id="sidebar" aria-label="课程目录">' + renderSidebar(rel, page.active) + '</nav>\n' +
    '  <main id="app" tabindex="-1">' + page.main + '</main>\n' +
    '</div>\n' +
    '<footer class="site-footer">\n' +
    '  <p><b>AI办公与写作实战</b>：面向中国职场人的交互式AI应用课程。个人项目，不代表任何机构。</p>\n' +
    '  <p>无需注册；学习进度、测验答案与练习记录仅保存在本浏览器的 localStorage 中，不会上传到任何服务器。 · ' + link('/pack', rel, '分享这门课', 'data-share-course') + '</p>\n' +
    '</footer>\n' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>\n' +
    '<script src="' + rel + 'assets/content.js" defer></script>\n' +
    '<script src="' + rel + 'assets/templates.js" defer></script>\n' +
    '<script src="' + rel + 'assets/seo.js" defer></script>\n' +
    '<script src="' + rel + 'assets/share.js" defer></script>\n' +
    '<script src="' + rel + 'assets/widgets.js" defer></script>\n' +
    '<script src="' + rel + 'assets/app.js" defer></script>\n' +
    '</body>\n</html>\n';
}

/* ---------- 组装 ---------- */
function buildPages() {
  var pages = [];
  var homeMeta = metaFor('/');
  pages.push({
    route: '/', file: 'index.html', active: '/', meta: homeMeta,
    canonical: canonicalFor('/'), jsonLd: homeJsonLd(homeMeta), main: renderHome('./')
  });

  C.modules.forEach(function (m) {
    var route = '/m/' + m.id;
    pages.push({
      route: route, file: 'm/' + m.id + '/index.html', active: route, meta: metaFor(route),
      canonical: canonicalFor(route), jsonLd: moduleJsonLd(m), main: renderModule(m, relFor(route))
    });
  });

  var toolsMeta = metaFor('/tools');
  pages.push({
    route: '/tools', file: 'tools/index.html', active: '/tools', meta: toolsMeta,
    canonical: canonicalFor('/tools'), jsonLd: toolsJsonLd(toolsMeta), main: renderTools(relFor('/tools'))
  });

  var tplMeta = metaFor('/templates');
  pages.push({
    route: '/templates', file: 'templates/index.html', active: '/templates', meta: tplMeta,
    canonical: canonicalFor('/templates'), jsonLd: collectionJsonLd(tplMeta), main: renderTemplatesIndex(relFor('/templates'))
  });

  T.forEach(function (t) {
    var route = '/templates/' + t.id;
    var meta = metaFor(route);
    pages.push({
      route: route, file: 'templates/' + t.id + '/index.html', active: '/templates', meta: meta,
      canonical: canonicalFor(route), jsonLd: templateJsonLd(t, meta), main: renderTemplate(t, relFor(route))
    });
  });

  [
    { id: 'workshop', name: '提示词工坊' },
    { id: 'checklist', name: '输出核验助手' },
    { id: 'pack', name: '我的模板包' }
  ].forEach(function (tool) {
    var route = '/' + tool.id;
    var meta = metaFor(route);
    pages.push({
      route: route, file: tool.id + '/index.html', active: route, meta: meta,
      canonical: canonicalFor(route), jsonLd: toolJsonLd(tool, meta), main: renderTool(tool, relFor(route))
    });
  });

  return pages;
}

function writeFile(relPath, content) {
  var full = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function writeRobots() {
  var content = 'User-agent: *\nAllow: /\n';
  if (SITE_URL) content += '\nSitemap: ' + new URL('sitemap.xml', SITE_URL + '/').href + '\n';
  writeFile('robots.txt', content);
}

function writeSitemap(pages) {
  if (!SITE_URL) return;
  var urls = pages.map(function (page) {
    return '  <url><loc>' + esc(absolute(page.route)) + '</loc></url>';
  });
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n';
  writeFile('sitemap.xml', xml);
}

function main() {
  var pages = buildPages();
  pages.forEach(function (page) {
    writeFile(page.file, shell(page));
  });
  writeRobots();
  writeSitemap(pages);
  console.log('已生成 ' + pages.length + ' 个页面。');
  if (SITE_URL) {
    console.log('站点地址：' + SITE_URL + '/');
    console.log('已生成 sitemap.xml，并写入 robots.txt。');
  } else {
    console.log('未设置 SITE_URL，已跳过 sitemap.xml；设置后重新运行可生成绝对 canonical 与 sitemap。');
    console.log('例如：SITE_URL=https://example.com/ai-work node scripts/build.js');
    if (fs.existsSync(path.join(ROOT, 'sitemap.xml'))) {
      console.log('注意：仓库中已有 sitemap.xml，可能包含旧的站点地址；更换域名后请重新生成或手动更新。');
    }
  }
}

main();
