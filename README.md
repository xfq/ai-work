# AI办公与写作实战

交互式课程网站：5 个模块的讲义与测验，其中 4 个模块配有实践任务，另含提示词模板库、提示词工坊、输出核验助手和「我的模板包」导出。学习进度和练习记录会保存在浏览器 localStorage 中。

## 本地打开

```bash
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

也可以直接双击 `index.html` 打开；`file://` 下会自动回退到 hash 路由。

## 修改内容后重新生成

静态页面由 `scripts/build.js` 生成，内容来源是 `assets/content.js` 和 `assets/templates.js`：

```bash
node scripts/build.js
```

生成时传入 `SITE_URL`，会额外生成 `sitemap.xml`、写入 `robots.txt`，并把 canonical、`og:url` 和 `og:image` 写成绝对地址：

```bash
SITE_URL=https://example.com/ai-work node scripts/build.js
```

生成出来的 HTML 需要一起提交/部署，服务器上不需要运行构建。

## 文件结构

| 文件 | 内容 |
|---|---|
| `index.html` | 首页（由 `scripts/build.js` 生成，勿直接编辑） |
| `assets/content.js` | 课程正文：模块、讲义、测验、实践任务 |
| `assets/templates.js` | 提示词模板库（`{{变量}}` 会渲染成输入框） |
| `assets/seo.js` | 浏览器与生成脚本共用的标题、描述和路由元数据 |
| `assets/widgets.js` | 讲义中的交互组件与工具页 |
| `assets/share.js` | 分享卡片、分享弹窗与课程/模板二维码 |
| `assets/app.js` | 路由、进度、测验、实践任务、模板库页面 |
| `assets/og.png` | 社交分享预览图（1200×630） |
| `assets/style.css` | 样式 |
| `scripts/build.js` | 零依赖静态页面生成器 |
| `m/`、`templates/`、`workshop/`、`checklist/`、`pack/` | 生成的静态页面，勿直接编辑 |
| `robots.txt` | 由生成脚本写入 |
| `sitemap.xml` | 设置 `SITE_URL` 后生成 |

修改课程内容一般只需编辑 `content.js` 和 `templates.js`，然后重新运行 `node scripts/build.js`。
