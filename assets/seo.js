/* 站点级 SEO 文案与路由元数据。浏览器和 scripts/build.js 共用这一份，避免静态页与运行时标题/描述不一致。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SEO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SITE_NAME = 'AI办公与写作实战';
  var HOME_TITLE = SITE_NAME + '｜职场人的AI应用能力课';
  var NOT_FOUND_META = {
    title: '页面没有找到｜' + SITE_NAME,
    desc: '没有找到这个页面。返回课程首页，继续学习AI办公与写作。',
    noindex: true
  };

  function hasQuiz(m) { return !!(m.quiz && m.quiz.length); }
  function hasPractice(m) { return !!m.practice; }
  function moduleById(C, id) {
    for (var i = 0; i < C.modules.length; i++) if (C.modules[i].id === id) return C.modules[i];
    return null;
  }
  function templateById(T, id) {
    for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i];
    return null;
  }
  function homeDesc(C, T) {
    var cases = C.toolCases && C.toolCases.cases ? C.toolCases.cases.length : 0;
    return '面向中国职场人的交互式AI办公课程：用AI起草通知、邮件、周报，整理会议纪要，做数据初步分析和PPT框架，并学会核验AI输出。' +
      C.modules.length + '个模块、' + T.length + '条可填空提示词模板' + (cases ? '、' + cases + '个工具实操案例' : '') + '，无需注册，学习进度只保存在本机。';
  }
  function pageMeta(parts, C, T) {
    if (!parts.length) return { title: HOME_TITLE, desc: homeDesc(C, T) };
    if (parts[0] === 'm') {
      var m = moduleById(C, parts[1]);
      if (!m) return NOT_FOUND_META;
      return {
        title: '模块' + m.no + '：' + m.title + '｜' + SITE_NAME,
        desc: m.goal + '模块' + m.no + '共' + m.sections.length + '节讲义' + (hasQuiz(m) ? '，含小测验' : '') + (hasPractice(m) ? '与实践任务' : '') + '。'
      };
    }
    if (parts[0] === 'tools') return {
      title: '工具实操：WorkBuddy、对话工具、PPT 工具怎么用｜' + SITE_NAME,
      desc: '三个真实任务的操作示例：用 WorkBuddy 把会议记录整理成纪要和待办，用对话工具写周报，用 PPT 工具做视觉初稿；含界面截图、提示词和验收清单。'
    };
    if (parts[0] === 'templates') {
      var sel = templateById(T, parts[1]);
      if (sel) return {
        title: sel.title + '提示词模板｜' + SITE_NAME,
        desc: '「' + sel.title + '」提示词模板：' + (sel.scene || '') + '按「角色+背景+任务+要求+格式」组织，变量可在线填写后复制使用。'
      };
      return {
        title: '提示词模板库｜' + T.length + '条职场AI提示词｜' + SITE_NAME,
        desc: '收录通知、邮件、周报、汇报、会议纪要、数据整理与PPT等场景的' + T.length + '条职场AI提示词模板，变量可在线填写，一键复制，支持搜索、分类和收藏。'
      };
    }
    if (parts[0] === 'workshop') return {
      title: '提示词工坊｜搭建结构化提示词｜' + SITE_NAME,
      desc: '按「角色+背景+任务+要求+格式」五要素搭建结构化提示词，实时评估完整度，并把常用AI指令保存为可复用模板。'
    };
    if (parts[0] === 'checklist') return {
      title: '输出核验助手｜事实、逻辑、合规三道关口｜' + SITE_NAME,
      desc: '粘贴AI生成的文字，自动标出数字、日期、因果与绝对化表述、敏感信息，再用「事实→逻辑→合规」三道关口清单逐项核验。'
    };
    if (parts[0] === 'pack') return {
      title: '我的模板包｜导出个人AI办公工具箱｜' + SITE_NAME,
      desc: '收集收藏的提示词、自建模板和各模块练习记录，一键导出 Markdown，形成可带走的个人AI办公模板包。'
    };
    return NOT_FOUND_META;
  }

  return {
    SITE_NAME: SITE_NAME,
    HOME_TITLE: HOME_TITLE,
    NOT_FOUND_META: NOT_FOUND_META,
    pageMeta: pageMeta
  };
});
