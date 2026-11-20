/* 交互组件。每个组件签名为 (el, App)，在讲义中通过 <div data-widget="名称"> 挂载。 */
window.WIDGETS = (function () {
  function esc(s) { return window.App.esc(s); }
  function seg(options, on) {
    return '<div class="seg">' + options.map(function (o, i) { return '<button data-i="' + i + '" class="' + (i === on ? 'on' : '') + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function tabs(el, title, labels, render) {
    var cur = 0;
    function draw() {
      el.innerHTML = (title ? '<div class="widget-title">' + esc(title) + '</div>' : '') + seg(labels, cur) + '<div class="tab-body" style="margin-top:12px">' + render(cur) + '</div>';
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.seg button'); if (b) { cur = +b.getAttribute('data-i'); draw(); }
      var c = e.target.closest('[data-copytext]'); if (c) window.App.copy(c.parentNode.parentNode.querySelector('pre.prompt').textContent);
    });
    draw();
  }
  function promptWithCopy(text) {
    return '<div><pre class="prompt">' + esc(text) + '</pre><div class="btn-row" style="margin-top:-4px"><button class="btn small" data-copytext>复制这条提示词</button></div></div>';
  }

  var W = {};

  /* ---------- 模块一：任务分拣 ---------- */
  W.sorter = function (el, App) {
    var items = [
      { t: '把会议录音转写稿整理成待办清单', a: 'ai', why: '提炼、归类是AI的强项；整理后由人核对责任人和时限即可。' },
      { t: '决定是否向客户说明延期的全部原因', a: 'human', why: '这是价值取舍：涉及客户关系和责任认定，需要有权限的人决定。AI可以帮你起草不同口径的版本供选择。' },
      { t: '把一段口语化的说明改写成正式通知', a: 'ai', why: '改写和转换语体正是AI擅长的。' },
      { t: '确认报告里引用的政策文件是否仍然有效', a: 'human', why: '事实判断：AI可能给出过时甚至编造的信息，必须查官方来源。' },
      { t: '把30条员工反馈按主题分类', a: 'ai', why: '归类是AI的强项；分类结果由人抽查确认。' },
      { t: '给两名候选人的晋升排序', a: 'human', why: '涉及对人的评价和组织取舍，必须由人负责。' },
      { t: '把一张表格的内容写成一段文字说明', a: 'ai', why: '格式转换是AI的强项，写完要核对数字。' },
      { t: '判断本月销量下滑是不是因为竞争对手降价', a: 'human', why: '因果判断需要业务事实。AI可以列出可能原因作为假设，但结论要靠你验证。' }
    ];
    var ans = App.store.get('w:sorter', {});
    function draw() {
      var right = 0, done = 0;
      el.innerHTML = '<div class="widget-title">小练习：这件事该交给谁？</div>' + items.map(function (it, i) {
        var a = ans[i], fb = '';
        if (a) { done++; if (a === it.a) right++; fb = '<div class="fb ' + (a === it.a ? 'ok' : 'no') + '">' + (a === it.a ? '✓ ' : '✗ 更适合' + (it.a === 'ai' ? '交给AI初稿' : '由人来判断') + '。') + esc(it.why) + '</div>'; }
        return '<div class="sort-item"><span>' + esc(it.t) + '</span><span><button class="chip' + (a === 'ai' ? ' on' : '') + '" data-i="' + i + '" data-a="ai">交给AI初稿</button><button class="chip' + (a === 'human' ? ' on' : '') + '" data-i="' + i + '" data-a="human">由人来判断</button></span>' + fb + '</div>';
      }).join('') + '<div class="small muted" style="margin-top:8px">已作答 ' + done + '/' + items.length + '，答对 ' + right + ' 题' + (done ? ' · <button class="btn small ghost" data-reset>重来</button>' : '') + '</div>';
    }
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) { ans = {}; App.store.set('w:sorter', ans); draw(); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      ans[b.getAttribute('data-i')] = b.getAttribute('data-a'); App.store.set('w:sorter', ans); draw();
    });
    draw();
  };

  /* ---------- 模块二：五要素拆解 ---------- */
  W.anatomy = function (el) {
    var parts = [
      { k: 'role', n: '角色', t: '你是一名有十年经验的项目经理，擅长与客户沟通，说话专业而诚恳。', lose: '少了角色：AI用“通用助手”的口吻写，容易过于客套或过于生硬，专业判断（比如该不该解释技术细节）也会变弱。' },
      { k: 'ctx', n: '背景', t: '背景：A项目原定6月30日上线，因第三方支付接口延迟交付，需延期至7月15日。我方已增派两名工程师，并将每周五同步一次进度。', lose: '少了背景：AI不知道具体日期、原因和补救措施，只能写出满篇【XX】的模板稿，甚至自己编一个原因。' },
      { k: 'task', n: '任务', t: '任务：写一封发给客户方项目负责人李经理的延期通知邮件。', lose: '少了任务：AI不知道要写通知、邮件还是汇报，也不知道写给谁，可能直接开始分析“延期的原因与对策”。' },
      { k: 'req', n: '要求', t: '要求：300字以内；诚恳但不卑微；不要把责任全部推给第三方；不做超出以上措施的承诺；只使用以上信息，缺失处标注【待补充】。', lose: '少了要求：篇幅、语气失控，可能把责任全推给第三方，或者擅自承诺“免费延长维护期”。' },
      { k: 'fmt', n: '格式', t: '格式：按“邮件主题 / 正文 / 署名”三部分输出，正文分3段。', lose: '少了格式：可能输出成一大段文字，或者夹带“以下是为您生成的邮件”这类多余的话，复制使用不方便。' }
    ];
    var off = {};
    function draw() {
      var losses = parts.filter(function (p) { return off[p.k]; });
      el.innerHTML = '<div class="widget-title">五要素拆解：点击标签开关要素</div>' + parts.map(function (p) {
        return '<div class="anatomy-line' + (off[p.k] ? ' off' : '') + '"><button class="tag ' + p.k + '" data-k="' + p.k + '" style="border:0" aria-pressed="' + (!off[p.k]) + '">' + p.n + '</button><span class="el-' + p.k + '">' + esc(p.t) + '</span></div>';
      }).join('') +
        (losses.length ? losses.map(function (p) { return '<div class="callout bad small" style="margin:8px 0">' + esc(p.lose) + '</div>'; }).join('') : '<div class="callout good small" style="margin:8px 0">五个要素都在：AI知道“以谁的身份、在什么情况下、给谁、写什么、写成什么样”。</div>');
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; off[b.getAttribute('data-k')] = !off[b.getAttribute('data-k')]; draw(); });
    draw();
  };

  /* ---------- 模块二：三种指令模式 ---------- */
  W.modes = function (el) {
    var data = [
      { use: '任务标准明确，你清楚“好结果”长什么样。', prompt: '你是一名资深人力资源专员。\n请为“新员工入职第一周安排”写一份通知，发给本月入职的8名新员工。\n要求：包含报到时间地点、需携带材料、第一周日程、联系人；语气热情但正式；400字以内。\n格式：标题 + 编号分点。', tip: '把你心里的标准写成可检查的条件（字数、必含内容、语气）。' },
      { use: '风格或格式难以描述，但手头有满意的样例。', prompt: '下面是我们部门过去一篇评价很好的周报，请仔细学习它的结构、语气和详略：\n【样例】\n……（粘贴样例）\n请按照完全相同的结构和风格，根据以下本周素材写一份新的周报：\n【本周素材】\n……\n注意：只模仿结构和风格，不要沿用样例中的具体事项和数据。', tip: '样例要选真正满意的；一定要强调“不要沿用样例的内容”，否则AI可能把旧数据带进来。' },
      { use: '复杂或要求不确定的任务；任何一次输出不满意时。', prompt: '第1轮：先不要写正文，请列出这份年度总结的提纲和每部分要用到的素材。\n第2轮：提纲第三部分太虚，请改成“三个具体项目 + 每个项目的数据成果”。\n第3轮：第二段语气太像宣传稿，请改得平实一些，其他部分不动。\n第4轮：整体压缩到800字，优先删除形容词，保留所有数据。', tip: '每次只提一两个具体修改点，并说明“其他部分不动”，避免越改越乱。' }
    ];
    tabs(el, '三种指令模式', ['专家型指令', '示范型指令', '迭代型指令'], function (i) {
      var d = data[i];
      return '<p><b>适用：</b>' + esc(d.use) + '</p>' + promptWithCopy(d.prompt) + '<div class="callout tip small"><b>要点</b>' + esc(d.tip) + '</div>';
    });
  };

  /* ---------- 模块二实践：裸提示 vs 结构化 ---------- */
  W.bareVsStructured = function (el) {
    var bare = '帮我写一份项目延期通知';
    var bareOut = '关于XX项目延期的通知\n\n各相关单位/部门：\n由于种种原因，XX项目将无法按原计划完成，现决定延期至XX月XX日。由此给大家带来的不便，我们深表歉意。我们将全力以赴，确保项目按新的时间节点高质量完成。\n感谢大家的理解与支持！\n\nXX公司\nXXXX年XX月XX日';
    var structured = '你是一名有十年经验的项目经理，擅长与客户沟通。\n背景：A项目原定6月30日上线，因第三方支付接口延迟交付，需延期至7月15日。我方已增派两名工程师，并将每周五同步一次进度。\n任务：写一封发给客户方项目负责人李经理的延期通知邮件。\n要求：300字以内；诚恳但不卑微；不要把责任全部推给第三方；不做超出以上措施的承诺；只使用以上信息，缺失处标注【待补充】。\n格式：邮件主题 / 正文 / 署名。';
    var structOut = '邮件主题：关于A项目上线时间调整至7月15日的说明\n\n李经理，您好：\n\n向您同步A项目的最新进展。由于第三方支付接口未能按期交付，我们对上线计划的预判不够充分，原定6月30日的上线时间需调整至7月15日，对此我们深表歉意。\n\n为确保新节点达成，我们已增派两名工程师投入联调，并将于每周五向您同步一次进度。如接口交付情况有变化，我们会第一时间告知。\n\n延期对贵方【待补充：如培训、推广等相关安排】可能带来影响，如需我方配合调整，请随时告诉我。\n\n【待补充：姓名、职务、联系方式】';
    tabs(el, '示例对比（示意，实际输出因工具而异）', ['裸提示', '结构化提示'], function (i) {
      return i === 0
        ? '<div class="sample-label">提示词</div>' + promptWithCopy(bare) + '<div class="sample-label">示例输出</div><div class="sample">' + esc(bareOut) + '</div><div class="callout bad small"><b>问题</b>满篇XX，原因含糊（“种种原因”）；不知道发给谁，口吻像公告；没有补救措施；几乎每一句都要重写。</div>'
        : '<div class="sample-label">提示词</div>' + promptWithCopy(structured) + '<div class="sample-label">示例输出</div><div class="sample">' + esc(structOut) + '</div><div class="callout good small"><b>改进</b>信息完整、收件人明确、语气得体；缺失的信息用【待补充】标出，改起来只需补几处。</div>';
    });
  };

  /* ---------- 模块三：收件人意识 ---------- */
  W.recipient = function (el) {
    var d = [
      { role: '你是一名项目经理，正在向部门总监汇报。', tone: '简洁、坦率，结论先行', detail: '重点写风险、影响和需要领导决定或支持的事项；技术细节从简', out: '主题：A项目上线需延期至7月15日，需协调测试资源\n\n王总：\n结论：A项目上线时间需从6月30日调整至7月15日。\n原因：第三方支付接口延迟交付，联调无法如期开始。\n影响：客户侧原定7月初的推广活动可能需要顺延，我已准备好与客户沟通。\n需要您支持：测试人力目前不足，希望协调1名测试人员支援两周。\n我会在每周五向您同步进度。' },
      { role: '你是一名项目经理，正在与协作部门的同事沟通。', tone: '友好、务实，以协作为主', detail: '重点写对对方工作安排的影响、需要对方配合的时间点', out: '主题：A项目时间调整，测试排期需要一起对一下\n\n张工，你好：\n跟你同步一下，A项目因为第三方接口延迟，上线时间调整到7月15日。\n原定6月下旬的测试窗口需要相应顺延，预计联调在7月初完成，届时需要测试团队投入约一周。\n方便的话这周找个时间，我们把新的排期对一下？谢谢！' },
      { role: '你是一名有十年经验的项目经理，代表公司与客户沟通。', tone: '诚恳、专业，不推卸，不过度承诺', detail: '重点写对客户的影响与保障措施；内部分工、资源问题不对外说', out: '主题：关于A项目上线时间调整至7月15日的说明\n\n李经理，您好：\n由于第三方支付接口未能按期交付，A项目上线时间需调整至7月15日，对此我们深表歉意。\n我们已增派工程师全力推进联调，并将于每周五向您同步进度。如需调整贵方相关安排，我们会全力配合。' }
    ];
    tabs(el, '同一件事，三个收件人', ['发给上级', '发给平级', '发给客户'], function (i) {
      var x = d[i];
      return '<div class="table-scroll"><table class="t"><tr><th style="width:20%"><span class="tag role">角色</span></th><td>' + esc(x.role) + '</td></tr><tr><th><span class="tag req">语气</span></th><td>' + esc(x.tone) + '</td></tr><tr><th><span class="tag req">详略</span></th><td>' + esc(x.detail) + '</td></tr></table></div><div class="sample-label">示例输出（示意）</div><div class="sample">' + esc(x.out) + '</div>';
    });
  };

  /* ---------- 模块三：结构化投喂 ---------- */
  W.reportFeeder = function (el) {
    var material = '【本周完成】\n- 完成“618”活动页面上线，覆盖3个渠道\n- 整理用户反馈42条，归为5类\n【关键数据】\n- 活动页访问量1.2万，转化率3.1%（上周同类活动2.6%）\n【问题与风险】\n- 客服高峰期响应超时，平均等待6分钟\n【下周计划】\n- 与客服团队确定高峰期排班方案\n- 输出活动复盘报告';
    var logics = [
      { name: '成果—问题—计划', req: '按“本周成果—问题与风险—下周计划”三部分组织，每部分用编号要点。', fit: '适合例行周报、月报，读者习惯按固定结构看。' },
      { name: '结论先行', req: '第一段用2—3句话给出本周最重要的结论和需要关注的风险，之后再分点展开支撑信息。', fit: '适合给忙碌的领导看、项目出现重要变化时。' }
    ];
    tabs(el, '结构化投喂：选择成文逻辑', logics.map(function (l) { return l.name; }), function (i) {
      var l = logics[i];
      var p = '你是一名擅长结构化表达的运营专员。\n以下是我本周的工作素材：\n' + material + '\n任务：据此写一份提交给部门经理的周报。\n要求：\n- ' + l.req + '\n- 只使用我提供的信息，不要补充或推测任何进展和数字，缺失处标注【待补充】；\n- 全文不超过400字。';
      return '<p class="small"><b>适用：</b>' + esc(l.fit) + '</p>' + promptWithCopy(p) + '<p class="small muted">想用自己的素材？到<a href="#/templates/weekly-report">模板库的周报模板</a>里填空即可。</p>';
    });
  };

  /* ---------- 模块三：风格指令 ---------- */
  W.styles = function (el) {
    var base = '产品信息：新上线的“智能报销”功能，拍照上传发票即可自动识别金额和类别，报销审批进度可在手机上实时查看。';
    var d = [
      { n: '专家/专业', i: '语气专业、客观，突出功能与效率价值，适合发给管理层或写进产品介绍。', t: '“智能报销”功能现已上线。员工拍照上传发票后，系统自动识别金额与费用类别，减少手工录入；审批进度支持移动端实时查询，提升报销流程的透明度与处理效率。' },
      { n: '亲和', i: '语气亲切、像同事聊天，适合员工群通知、内部公众号。', t: '报销再也不用一张张贴发票、手动填金额啦！“智能报销”上线了：拍张照，金额和类别自动识别；审批走到哪一步，手机上随时看得到。快去试试吧～' },
      { n: '简洁', i: '一句话讲清楚，适合即时消息、系统提示。', t: '“智能报销”已上线：拍照上传发票，自动识别金额类别，审批进度手机可查。' },
      { n: '有力', i: '短句、节奏强，突出变化，适合海报标题、活动推广。', t: '拍一下，就报销。\n金额自动识别，类别自动归档，进度实时可见。\n智能报销，现已上线。' }
    ];
    tabs(el, '风格指令对比（示意）', d.map(function (x) { return x.n; }), function (i) {
      var x = d[i];
      return '<p class="small muted">' + esc(base) + '</p><p class="small"><b>风格指令：</b>' + esc(x.i) + '</p><div class="sample">' + esc(x.t) + '</div>';
    });
  };

  /* ---------- 模块四：数据清洗演示 ---------- */
  W.dataClean = function (el) {
    var raw = [
      ['张伟-销售部', '13812345678', '2026/3/5', '上午场'],
      ['李娜-人力资源部', '13987654321', '3月6日', '下午场'],
      ['张伟-销售部', '13812345678', '2026-03-05', '上午场'],
      ['王强-财务部', '13700001111', '2026.3.7', '上午场'],
      ['刘洋 - 销售部', '13655556666', '2026-3-8', '下午场'],
      ['陈静-人力资源部', '13544447777', '20260308', '上午场'],
      ['赵敏-销售部', '13322223333', '2026年3月9日', '下午场']
    ];
    var ops = [
      { k: 'split', n: '拆分字段', say: '把“姓名-部门”拆成“姓名”和“部门”两列，去掉多余空格。' },
      { k: 'date', n: '统一日期格式', say: '把报名日期统一为 YYYY-MM-DD；缺少年份的，按2026年补全并标记出来，需要人工确认。' },
      { k: 'dedup', n: '去重', say: '姓名和手机号都相同的视为重复报名，只保留第一条，并告诉我删了几条。' },
      { k: 'mask', n: '脱敏', say: '手机号只保留前3位和后4位，中间用****代替；姓名替换为“员工+编号”。' },
      { k: 'sum', n: '分类汇总', say: '按部门和场次统计报名人数，输出汇总表。' }
    ];
    var on = {}, last = null;
    function normDate(s) {
      var m;
      if ((m = s.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})日?$/))) return { v: m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) };
      if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return { v: m[1] + '-' + m[2] + '-' + m[3] };
      if ((m = s.match(/^(\d{1,2})月(\d{1,2})日$/))) return { v: '2026-' + pad(m[1]) + '-' + pad(m[2]), flag: true };
      return { v: s };
    }
    function pad(n) { return ('0' + n).slice(-2); }
    function compute() {
      var head = on.split ? ['姓名', '部门', '手机号', '报名日期', '场次'] : ['姓名-部门', '手机号', '报名日期', '场次'];
      var rows = raw.map(function (r) {
        var row = { cells: on.split ? r[0].split('-').map(function (x) { return x.trim(); }).concat(r.slice(1)) : r.slice(), flags: {} };
        var di = on.split ? 3 : 2, pi = on.split ? 2 : 1;
        if (on.date) { var d = normDate(row.cells[di]); if (d.v !== row.cells[di]) row.flags[di] = 'changed'; row.cells[di] = d.v + (d.flag ? '（补全年份，待确认）' : ''); }
        row.key = r[0].replace(/\s/g, '') + r[1];
        row.pi = pi;
        return row;
      });
      var removed = 0;
      if (on.dedup) { var seen = {}; rows = rows.filter(function (r) { if (seen[r.key]) { removed++; return false; } seen[r.key] = 1; return true; }); }
      if (on.mask) {
        rows.forEach(function (r, i) {
          r.cells[r.pi] = r.cells[r.pi].slice(0, 3) + '****' + r.cells[r.pi].slice(-4); r.flags[r.pi] = 'changed';
          if (on.split) { r.cells[0] = '员工' + (i + 1); r.flags[0] = 'changed'; }
          else { r.cells[0] = '员工' + (i + 1) + '-' + r.cells[0].split('-').slice(1).join('-').trim(); r.flags[0] = 'changed'; }
        });
      }
      return { head: head, rows: rows, removed: removed };
    }
    function draw() {
      var r = compute();
      var html = '<div class="widget-title">清洗演示：依次点击指令（可多选，可撤销）</div><div>' + ops.map(function (o) { return '<button class="chip' + (on[o.k] ? ' on' : '') + '" data-k="' + o.k + '">' + (on[o.k] ? '✓ ' : '') + o.n + '</button>'; }).join('') + '<button class="btn small ghost" data-reset>还原</button></div>';
      if (last) { var o = ops.filter(function (x) { return x.k === last; })[0]; html += '<div class="callout tip small" style="margin:10px 0"><b>对应的自然语言指令</b>“' + esc(o.say) + '”</div>'; }
      html += '<div class="table-scroll"><table class="t data-table"><tr>' + r.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + r.rows.map(function (row) {
        return '<tr>' + row.cells.map(function (c, i) { return '<td class="' + (row.flags[i] || '') + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div><div class="small muted">共 ' + r.rows.length + ' 行' + (on.dedup ? '，去重删除 ' + r.removed + ' 行' : '') + '</div>';
      if (on.sum) {
        if (!on.split) html += '<div class="callout warn small"><b>无法汇总</b>“姓名-部门”还在同一列里，请先拆分字段。这也是让AI做汇总前要检查的：字段是否干净。</div>';
        else {
          var by = {}, depts = [], sessions = ['上午场', '下午场'];
          r.rows.forEach(function (row) { var d = row.cells[1]; if (!by[d]) { by[d] = { '上午场': 0, '下午场': 0 }; depts.push(d); } by[d][row.cells[4]]++; });
          html += '<div class="sample-label" style="margin-top:12px">汇总表</div><table class="t data-table"><tr><th>部门</th>' + sessions.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '<th>合计</th></tr>' + depts.map(function (d) {
            return '<tr><td>' + esc(d) + '</td>' + sessions.map(function (s) { return '<td>' + by[d][s] + '</td>'; }).join('') + '<td>' + (by[d]['上午场'] + by[d]['下午场']) + '</td></tr>';
          }).join('') + '</table>' + (!on.dedup ? '<div class="callout warn small"><b>注意</b>还没有去重，“张伟”被统计了两次，汇总数偏大。AI给出的汇总数要抽查原始数据核对。</div>' : '');
        }
      }
      el.innerHTML = html;
    }
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) { on = {}; last = null; draw(); return; }
      var b = e.target.closest('[data-k]'); if (!b) return;
      var k = b.getAttribute('data-k'); on[k] = !on[k]; last = on[k] ? k : null; draw();
    });
    draw();
  };

  /* ---------- 模块五：红线情景判断 ---------- */
  W.redline = function (el, App) {
    var items = [
      { t: '把一份已脱敏的会议转写，交给单位批准使用的AI工具整理纪要，再由记录人核对后发出。', a: 'ok', why: '数据已脱敏、工具已获批准、发出前有人核对，符合要求。' },
      { t: '用AI生成的解除劳动合同通知书，未经人事负责人和法务审核，直接盖章发给员工。', a: 'no', why: '触碰红线三：人事、法务类文书不得以AI输出直接定稿。' },
      { t: '用AI把公司已经公开发布的新闻稿，改写成一则内部宣传简讯。', a: 'ok', why: '素材是公开信息，改写属于AI擅长的工作；发布前仍按内部流程审核。' },
      { t: 'AI起草的客户邮件里写了“三天内全额退款”，你觉得语气不错就直接发了。', a: 'no', why: '触碰红线二：对外内容未经责任人审核，而且AI替公司做出了越权承诺。' },
      { t: '让AI检查财务分析报告初稿的错别字和表述，最终由财务负责人审定。', a: 'ok', why: 'AI只做辅助检查，定稿由专业负责人把关。注意报告中的未公开数据是否允许输入该工具。' }
    ];
    var ans = App.store.get('w:redline', {});
    function draw() {
      el.innerHTML = '<div class="widget-title">红线情景判断</div>' + items.map(function (it, i) {
        var a = ans[i], fb = '';
        if (a) fb = '<div class="fb ' + (a === it.a ? 'ok' : 'no') + '">' + (a === it.a ? '✓ ' : '✗ ') + esc(it.why) + '</div>';
        return '<div class="sort-item"><span>' + esc(it.t) + '</span><span><button class="chip' + (a === 'ok' ? ' on' : '') + '" data-i="' + i + '" data-a="ok">可以</button><button class="chip' + (a === 'no' ? ' on' : '') + '" data-i="' + i + '" data-a="no">不可以</button></span>' + fb + '</div>';
      }).join('');
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; ans[b.getAttribute('data-i')] = b.getAttribute('data-a'); App.store.set('w:redline', ans); draw(); });
    draw();
  };

  /* ---------- 工具：提示词工坊 ---------- */
  W.workshop = function (el, App) {
    var blank = { title: '', role: '', ctx: '', task: '', req: '', fmt: '', mode: 'expert', example: '', words: '', tones: [], banned: '', boundary: true, cot: false };
    var s = App.store.get('workshop', null) || JSON.parse(JSON.stringify(blank));
    var sample = { title: '项目延期通知（客户版）', role: '你是一名有十年经验的项目经理，擅长与客户沟通。', ctx: '{{项目名称}}原定{{原定日期}}上线，因{{延期原因}}，需延期至{{新日期}}。我方已采取的措施：{{补救措施}}。', task: '写一封发给{{收件人}}的延期通知邮件。', req: '不要把责任全部推给第三方；不做超出以上措施的承诺。', fmt: '按“邮件主题 / 正文 / 署名”输出，正文分3段。', mode: 'expert', example: '', words: '300', tones: ['诚恳', '专业'], banned: '保证、绝对、一定', boundary: true, cot: false };
    var toneOpts = ['专业', '诚恳', '亲和', '简洁', '有力', '正式'];
    function build() {
      var out = [];
      if (s.role.trim()) out.push(s.role.trim());
      if (s.ctx.trim()) out.push('背景：' + s.ctx.trim());
      if (s.mode === 'demo' && s.example.trim()) out.push('以下是一份参考样例，请学习它的结构和语气，但不要沿用其中的具体内容：\n【样例】\n' + s.example.trim());
      if (s.task.trim()) out.push('任务：' + s.task.trim());
      var req = [];
      if (s.req.trim()) req.push(s.req.trim());
      if (s.words) req.push('全文控制在' + s.words + '字以内');
      if (s.tones.length) req.push('语气' + s.tones.join('、'));
      if (s.banned.trim()) req.push('不要出现以下词语：' + s.banned.trim());
      if (s.boundary) req.push('只使用我提供的信息，缺失处标注【待补充】，不要自行编造');
      if (req.length) out.push('要求：\n' + req.map(function (r) { return '- ' + r.replace(/[；;。]$/, ''); }).join('；\n') + '。');
      if (s.fmt.trim()) out.push('格式：' + s.fmt.trim());
      if (s.cot) out.push('在输出正文之前，请先简要列出：读者最关心什么、必须传达的关键事实、可能引起误解的表述。然后再写正文。');
      if (s.mode === 'iter') out.push('请先给出初稿，然后提出2个你认为最值得我确认或补充的问题，我们再逐步修改。');
      return out.join('\n');
    }
    function score() {
      var pts = 0, tips = [];
      [['role', '角色', 16, '补上“你是一名……”，告诉AI以什么身份和水平来做。'], ['ctx', '背景', 22, '背景是最关键的：发生了什么、给谁看、已知哪些事实。'], ['task', '任务', 22, '写清楚具体要产出什么、给谁。'], ['fmt', '格式', 12, '规定输出的结构，复制使用更方便。']].forEach(function (x) {
        if (s[x[0]].trim().length >= 6) pts += x[2]; else tips.push(x[1] + '：' + x[3]);
      });
      if (s.req.trim() || s.words || s.tones.length || s.banned.trim()) pts += 16; else tips.push('要求/限制：至少加一条字数、语气或禁忌要求。');
      if (s.boundary) pts += 12; else tips.push('建议勾选“只使用我提供的信息”，防止AI编造。');
      if (s.mode === 'demo' && !s.example.trim()) tips.push('示范型指令需要粘贴一份样例。');
      return { pts: Math.min(100, pts), tips: tips };
    }
    function field(k, label, ph, tag) {
      return '<div class="field"><label><span class="tag ' + tag + '">' + label + '</span></label><textarea data-k="' + k + '" placeholder="' + esc(ph) + '" style="min-height:64px">' + esc(s[k]) + '</textarea></div>';
    }
    function drawForm() {
      el.innerHTML = '<div class="two-col"><div>' +
        '<div class="btn-row" style="margin:0 0 8px"><button class="btn small" data-sample>载入示例</button><button class="btn small ghost" data-clear>清空</button></div>' +
        '<div class="field"><label>指令模式</label><div class="seg" id="modeSeg">' + [['expert', '专家型'], ['demo', '示范型'], ['iter', '迭代型']].map(function (m) { return '<button data-mode="' + m[0] + '" class="' + (s.mode === m[0] ? 'on' : '') + '">' + m[1] + '</button>'; }).join('') + '</div></div>' +
        field('role', '角色', '你是一名……，擅长……', 'role') +
        field('ctx', '背景/语境', '发生了什么？给谁看？已知哪些事实和数据？可以用 {{变量}} 标出每次会变的内容', 'ctx') +
        '<div class="field" id="exField" style="' + (s.mode === 'demo' ? '' : 'display:none') + '"><label>参考样例（示范型）</label><textarea data-k="example" placeholder="粘贴一份你满意的过往范文">' + esc(s.example) + '</textarea></div>' +
        field('task', '任务', '请写一份发给……的……', 'task') +
        field('req', '要求/限制', '必须包含……；不要……', 'req') +
        '<div class="field"><label>常用限制</label>字数上限 <input type="text" data-k="words" value="' + esc(s.words) + '" style="width:80px;display:inline-block" placeholder="300"> 字' +
        '<div style="margin-top:6px">语气：' + toneOpts.map(function (t) { return '<button class="chip' + (s.tones.indexOf(t) >= 0 ? ' on' : '') + '" data-tone="' + t + '">' + t + '</button>'; }).join('') + '</div>' +
        '<div style="margin-top:6px"><input type="text" data-k="banned" value="' + esc(s.banned) + '" placeholder="禁忌词，用顿号分隔，如：保证、绝对"></div>' +
        '<label style="font-weight:400;margin-top:8px;display:flex;gap:8px"><input type="checkbox" data-c="boundary"' + (s.boundary ? ' checked' : '') + '>只使用我提供的信息，缺失处标注【待补充】</label>' +
        '<label style="font-weight:400;display:flex;gap:8px"><input type="checkbox" data-c="cot"' + (s.cot ? ' checked' : '') + '>先分析、再输出（思维链）</label></div>' +
        field('fmt', '输出格式', '按“标题 / 正文 / 落款”输出；或：用表格输出，列为……', 'fmt') +
        '</div><div class="sticky"><div class="card" style="margin:0"><div class="score" id="wsScore"></div><ul class="tips" id="wsTips"></ul>' +
        '<div class="sample-label">生成的提示词</div><div class="prompt-box" id="wsOut"></div>' +
        '<div class="field"><label>模板名称</label><input type="text" data-k="title" value="' + esc(s.title) + '" placeholder="如：项目延期通知（客户版）"></div>' +
        '<div class="btn-row"><button class="btn primary" data-copy>复制提示词</button><button class="btn" data-save>保存到我的模板包</button></div></div></div></div>';
      update();
    }
    function update() {
      App.store.set('workshop', s);
      var p = build(), sc = score();
      var out = el.querySelector('#wsOut');
      out.innerHTML = !p ? '<span class="muted">在左侧填写后，这里会实时拼出完整提示词。</span>' : p.split(/(\{\{[^}]+\}\})/).map(function (part) { return /^\{\{/.test(part) ? '<span class="var-hl">' + esc(part) + '</span>' : esc(part); }).join('');
      el.querySelector('#wsScore').innerHTML = '<b>完整度 ' + sc.pts + '</b><div class="bar"><i style="width:' + sc.pts + '%;background:' + (sc.pts >= 80 ? 'var(--good)' : sc.pts >= 50 ? 'var(--warn)' : 'var(--bad)') + '"></i></div>';
      el.querySelector('#wsTips').innerHTML = sc.tips.length ? sc.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') : '<li>五要素齐全，可以拿去试用了。试用后记得根据结果迭代。</li>';
    }
    el.addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; s[k] = e.target.value; update(); });
    el.addEventListener('change', function (e) { var c = e.target.getAttribute('data-c'); if (!c) return; s[c] = e.target.checked; update(); });
    el.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { s.mode = m.getAttribute('data-mode'); Array.prototype.forEach.call(el.querySelectorAll('[data-mode]'), function (b) { b.classList.toggle('on', b === m); }); el.querySelector('#exField').style.display = s.mode === 'demo' ? '' : 'none'; update(); }
      var t = e.target.closest('[data-tone]');
      if (t) { var v = t.getAttribute('data-tone'), i = s.tones.indexOf(v); if (i >= 0) s.tones.splice(i, 1); else s.tones.push(v); t.classList.toggle('on'); update(); }
      if (e.target.closest('[data-sample]')) { s = JSON.parse(JSON.stringify(sample)); drawForm(); }
      if (e.target.closest('[data-clear]')) { s = JSON.parse(JSON.stringify(blank)); drawForm(); }
      if (e.target.closest('[data-copy]')) { var p = build(); if (p) App.copy(p); else App.toast('提示词还是空的'); }
      if (e.target.closest('[data-save]')) { var q = build(); if (!q) { App.toast('提示词还是空的'); return; } App.addToPack({ kind: 'prompt', title: s.title.trim() || '未命名提示词', body: q, note: '来自提示词工坊' }); }
    });
    drawForm();
  };

  /* ---------- 工具：核验高亮 ---------- */
  W.highlighter = function (el, App) {
    var sample = '本季度，在部门全体同事的努力下，客户满意度提升至96.5%，同比增长18%。由于我们在3月开展了两次服务培训，投诉量因此大幅下降，这在行业内尚属首次。根据《客户服务管理办法（2025年修订）》第十二条，下一步我们将对所有客户实行7×24小时响应，并保证问题在24小时内全部解决。内部测算显示，新方案可节约成本约120万元。联系人：王经理，13812345678。';
    var re = new RegExp([
      '(?<risk>(?<!\\d)1[3-9]\\d{9}(?!\\d)|(?<!\\d)\\d{17}[\\dXx](?!\\d)|内部|保密|机密|涉密|未公开|不得外传|薪资|工资|身份证|承诺|保证|赔偿|退款|赔付)',
      '(?<logic>因此|所以|由于|导致|因为|从而|显著|大幅|全面|彻底|必然|一定|绝对|完全|所有|全部|始终|首次|唯一|第一|最[^\\s，。、；]?)',
      '(?<fact>《[^》]{1,40}》|第[一二三四五六七八九十百零\\d]+[条款章节项]|\\d{4}年(?:\\d{1,2}月)?(?:\\d{1,2}日)?|\\d{1,2}月\\d{1,2}日|\\d+(?:\\.\\d+)?(?:[×xX]\\d+)?\\s*(?:%|％|万元|亿元|万|亿|元|人次|人|个|次|天|周|月|年|日|号|小时|分钟|倍|项|场|家|条|页|台|件)?)'
    ].join('|'), 'g');
    var txt = App.store.get('w:hl', '');
    el.innerHTML = '<div class="widget-title">粘贴AI生成的文字</div><textarea id="hlIn" style="min-height:120px" placeholder="把AI生成的文字粘贴到这里……">' + esc(txt) + '</textarea>' +
      '<div class="btn-row"><button class="btn small" data-sample>用示例文字试试</button><button class="btn small ghost" data-clear>清空</button></div>' +
      '<div class="legend" style="margin:12px 0 6px"><span><mark class="m-fact">蓝色</mark> 事实：数字、日期、文件名，逐一对照原始材料</span><span><mark class="m-logic">黄色</mark> 逻辑：因果、绝对化表述，确认是否有依据</span><span><mark class="m-risk">红色</mark> 合规：敏感信息、内部信息、承诺，确认能否对外</span></div>' +
      '<div class="hl-out" id="hlOut"></div><div class="small muted" id="hlCount" style="margin-top:6px"></div>';
    var input = el.querySelector('#hlIn'), out = el.querySelector('#hlOut'), cnt = el.querySelector('#hlCount');
    function run() {
      var t = input.value, html = '', last = 0, c = { fact: 0, logic: 0, risk: 0 }, m;
      App.store.set('w:hl', t);
      re.lastIndex = 0;
      while ((m = re.exec(t))) {
        if (!m[0]) { re.lastIndex++; continue; }
        var k = m.groups.risk ? 'risk' : m.groups.logic ? 'logic' : 'fact';
        if (k === 'fact' && !/\d|《|第/.test(m[0])) continue;
        html += esc(t.slice(last, m.index)) + '<mark class="m-' + k + '">' + esc(m[0]) + '</mark>';
        last = m.index + m[0].length; c[k]++;
      }
      html += esc(t.slice(last));
      out.innerHTML = t ? html : '<span class="muted">高亮结果会显示在这里。</span>';
      cnt.textContent = t ? ('待核对：事实 ' + c.fact + ' 处 · 逻辑 ' + c.logic + ' 处 · 合规 ' + c.risk + ' 处。规则只做提醒，没有标出的地方同样需要通读核对。') : '';
    }
    input.addEventListener('input', run);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-sample]')) { input.value = sample; run(); }
      if (e.target.closest('[data-clear]')) { input.value = ''; run(); }
    });
    run();
  };

  /* ---------- 工具：三道关口清单 ---------- */
  W.gates = function (el, App) {
    var gates = [
      { n: '第一关：事实核验', items: ['所有数字、百分比、金额已与原始材料逐一核对', '日期、时间、地点准确无误，前后一致', '人名、职务、机构和部门名称准确', '引用的文件、制度、政策条款真实存在且为现行有效版本', 'AI没有添加原始材料中不存在的事项或进展'] },
      { n: '第二关：逻辑核验', items: ['因果关系有事实依据，没有把“同时发生”写成“因为所以”', '结论与支撑材料匹配，没有跳跃或夸大（如“显著”“全面”）', '全文前后没有矛盾', '没有遗漏重要的反面信息或风险'] },
      { n: '第三关：合规核验', items: ['不含未公开、涉密或仅限内部的信息（对外材料）', '不含身份证号、手机号、薪资等个人敏感信息', '没有越权表态或作出未经授权的承诺', '图片、引文等素材来源清楚，不侵犯版权', '已由责任人审核；人事、法务、财务类文书已经专业人员审定'] }
    ];
    var st = App.store.get('w:gates', {});
    function draw() {
      var total = 0, done = 0;
      el.innerHTML = '<div class="widget-title">三道关口核验清单</div>' + gates.map(function (g, gi) {
        return '<div class="check-gate"><h2>' + g.n + '</h2>' + g.items.map(function (it, ii) {
          var k = gi + '-' + ii; total++; if (st[k]) done++;
          return '<label><input type="checkbox" data-k="' + k + '"' + (st[k] ? ' checked' : '') + '>' + esc(it) + '</label>';
        }).join('') + '</div>';
      }).join('') + '<div class="score"><b>' + done + ' / ' + total + '</b><div class="bar"><i style="width:' + (done / total * 100) + '%"></i></div>' + (done === total ? '<span class="status done">可以进入发布/提交流程</span>' : '') + '</div>' +
        '<div class="btn-row"><button class="btn small ghost" data-reset>清空勾选，检查下一份</button><button class="btn small" data-pack>把清单加入模板包</button></div>';
    }
    el.addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; st[k] = e.target.checked; App.store.set('w:gates', st); draw(); });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) { st = {}; App.store.set('w:gates', st); draw(); }
      if (e.target.closest('[data-pack]')) App.addToPack({ kind: 'checklist', title: '三道关口核验清单', body: gates.map(function (g) { return '### ' + g.n + '\n' + g.items.map(function (i) { return '- [ ] ' + i; }).join('\n'); }).join('\n\n') });
    });
    draw();
  };

  /* ---------- 工具：我的模板包 ---------- */
  W.pack = function (el, App) {
    var kinds = { prompt: '提示词', note: '练习记录', checklist: '核验清单' };
    function draw() {
      var pack = App.store.get('pack', []);
      el.innerHTML = '<div class="btn-row" style="margin-bottom:14px"><button class="btn primary" data-export>导出为 Markdown</button>' +
        '<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="incPractice" checked>同时导出各模块的全部练习记录</label>' +
        (pack.length ? '<button class="btn small ghost" data-clearall>清空模板包</button>' : '') + '</div>' +
        (pack.length ? pack.map(function (p, i) {
          return '<div class="card"><div class="small muted">' + (kinds[p.kind] || '条目') + ' · ' + new Date(p.ts).toLocaleString('zh-CN') + '</div><h3>' + esc(p.title) + '</h3>' + (p.note ? '<p class="small muted">' + esc(p.note) + '</p>' : '') +
            '<pre class="prompt">' + esc(p.body) + '</pre><div class="btn-row"><button class="btn small" data-copy="' + i + '">复制</button><button class="btn small ghost" data-del="' + i + '">删除</button></div></div>';
        }).join('') : '<div class="card"><p class="empty">模板包还是空的。去<a href="#/templates">模板库</a>收藏模板、在<a href="#/workshop">提示词工坊</a>保存自建提示词，或在模块的实践任务中点击“把练习记录加入模板包”。</p></div>');
    }
    function exportMd() {
      var pack = App.store.get('pack', []);
      var home = window.SHARE ? window.SHARE.homeUrl() : '';
      var md = ['# 我的AI办公模板包', '', '> 来自《AI办公与写作实战》课程 · 导出于 ' + new Date().toLocaleString('zh-CN'), ''];
      if (home) md.push('> 课程地址：' + home, '');
      ['prompt', 'checklist', 'note'].forEach(function (k) {
        var items = pack.filter(function (p) { return p.kind === k; });
        if (!items.length) return;
        md.push('## ' + kinds[k], '');
        items.forEach(function (p) { md.push('### ' + p.title, ''); if (p.note) md.push('*' + p.note + '*', ''); md.push(k === 'prompt' ? '```text\n' + p.body + '\n```' : p.body, ''); });
      });
      var sec = null;
      if (el.querySelector('#incPractice').checked) {
        sec = [];
        App.course.modules.forEach(function (m) {
          if (!m.practice) return;
          var d = App.store.get('practice:' + m.id, { fields: {} });
          var body = App.practiceToMarkdown(m, d);
          if (body.trim()) sec.push('### 模块' + m.no + '：' + m.practice.title, '', body, '');
        });
        if (sec.length) { md.push('## 各模块练习记录', ''); md = md.concat(sec); } else sec = null;
      }
      if (!pack.length && !sec) { App.toast('还没有可导出的内容'); return; }
      md.push('---', '', '由《AI办公与写作实战》生成' + (home ? '：' + home : '') + '。免费、无需注册。');
      var blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = '我的AI办公模板包.md';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      App.toast('已导出');
    }
    el.addEventListener('click', function (e) {
      var pack = App.store.get('pack', []);
      var c = e.target.closest('[data-copy]'); if (c) App.copy(pack[+c.getAttribute('data-copy')].body);
      var d = e.target.closest('[data-del]'); if (d) { pack.splice(+d.getAttribute('data-del'), 1); App.store.set('pack', pack); draw(); }
      if (e.target.closest('[data-clearall]') && confirm('确定清空模板包中的全部条目吗？')) { App.store.set('pack', []); draw(); }
      if (e.target.closest('[data-export]')) exportMd();
    });
    draw();
  };

  return W;
})();
