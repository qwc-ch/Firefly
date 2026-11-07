---
title: 评论图片直传图床：Waline + EdgeOne 边缘函数踩坑记
published: 2026-11-07
image: 'api'
description: Waline 评论默认把图片转成 base64 塞进评论数据，又慢又胀。本文记录给评论加上图片直传的全过程：用 EdgeOne 边缘函数做鉴权代理把密钥留在服务端，以及 545、401、404 三层报错的排错实录，还有一次被主动放弃的"点发送才上传"设计。
tags: [Waline, EdgeOne, CloudFlare, 图床, 排错]
category: 'blog'
draft: false
lang: 'zh-CN'
slug: waline-image-upload-edgeone
---

## 起因

博客评论区用的 Waline。访客在评论里插图，走的是它的默认路径：图片读进浏览器转成 **base64 直接塞进评论内容**，还有 128KB 的大小上限。截图稍微大一点就传不了，传上去了也是一坨几万字符的 base64 糊在评论数据里， loading 慢、数据库胀。

我的图床是自建的 [CloudFlare ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)，上传走 `a.520781.xyz`，展示走 `tu.520781.xyz`，本来就有现成的上传接口。所以目标很明确：

- 评论里的图片直接传到图床，评论数据里只存一个短链接；
- 图床的鉴权码**绝不能出现在前端**；
- 访客无感知：选图 → 发送，和平时一样。

## 为什么鉴权不能放前端

最开始偷懒想过直接把图床的 `authCode` 写进主题配置。但这是个**静态博客**——所有配置在构建时就被打包进 HTML，原样下发到每一个访客的浏览器里。把鉴权码放进去，等于把上传权限公开挂在网上，任何人 view-source 一下就能拿去无限传图。

所以必须有一个服务端持有密钥的转发层。博客本身部署在多个平台，但腾讯 **EdgeOne Pages** 自带边缘函数（Pages Functions），仓库里放一个 `functions/upload.js` 就会挂在 `/upload` 路由上，不用额外维护服务器，环境变量存在 EO 控制台里，正好合适。

## 架构：用一个边缘函数当守门人

```
评论区选图
   │  (前端只带一个公开的 endpoint 地址)
   ▼
image-upload.520781.xyz/upload   ← EdgeOne 边缘函数
   │  1. 校验 Origin 白名单（不在名单内 → 403）
   │  2. 校验仅图片、大小上限
   │  3. 补上鉴权，转发图床（密钥只在这一跳出现）
   ▼
a.520781.xyz/upload?authCode=***   ← 图床
   │  返回 { src: "/file/waline/xxx.png" }
   ▼
边缘函数把相对路径改写成展示域名
   ▼
前端拿到 https://tu.520781.xyz/file/waline/xxx.png 写进评论
```

环境变量全在 EO 控制台配置，前端代码里只有一个 endpoint 地址：

| 变量 | 作用 |
| --- | --- |
| `AUTH_CODE` | 图床上传鉴权（只存服务端） |
| `UPLOAD_HOST` | 图床上传域名（裸域名，如 `https://a.xxx.com`） |
| `DISPLAY_HOST` | 图片展示域名，用于改写返回的相对路径 |
| `ALLOWED_ORIGINS` | 允许调用的博客来源，逗号分隔 |
| `UPLOAD_FOLDER` | 图床内目录，评论图单独放 |
| `MAX_SIZE_MB` | 单图上限，默认 10 |

来源校验的逻辑很简单：浏览器发起跨域 POST 时**必然**带 `Origin` 头，白名单外的来源——包括不带 Origin 的 curl 脚本直传——一律 403。防刷的限速则完全交给 EO 平台自带能力（控制台 → Web 防护 → 速率限制，对 `/upload` 配个每分钟次数），不在函数里自研——边缘函数多实例部署，内存计数器根本数不准，平台层的能力才是对的。

## 前端：其实只需要三十行

这部分是最意外的惊喜。原以为要 hack Waline 的编辑器，读完源码才发现它原生就有一套完整的上传体验，只要提供一个 `imageUploader` 函数：

```js
config.imageUploader = async (file) => {
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form }).catch(() => {
    throw new Error("图片上传失败：无法连接上传服务");
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`图片上传失败（HTTP ${res.status}）${data?.error ? `：${data.error}` : ""}`);
  }
  const item = Array.isArray(data) ? data[0] : data;
  const url = item?.url || item?.src || item?.publicUrl;
  if (!url) throw new Error("图片上传失败：上传服务返回内容异常");
  return url;
};
```

剩下的全是 Waline 自己做的：

- 选图后编辑器先插入 `![上传中 文件名]()` 占位，**发送按钮自动锁定**；
- 上传完成，占位自动替换成真实链接；
- 失败则原生 alert 提示并移除占位，评论文本干干净净。

编辑器里从头到尾都是真实链接，没有任何假 URL。

## 踩坑实录

上面的架构图是终点，过程是另一回事。部署后第一次联调，三层 curl 测试直接给我表演了三连：**545、401、404**，一个比一个谜。

### 坑一：HTTP 545——函数明明部署成功了

现象很刁钻：`GET /` 返回 200，`OPTIONS` 预检返回 204，唯独 `POST /upload` 全部返回 **545**。查了半天才知道这是 EdgeOne 的平台层错误码，意思是"脚本执行出错"——函数里抛了没接住的异常。

可函数逻辑看着没问题？真正的坑在**环境变量的取法**。EO 的文档里，Pages 函数从 `context.env` 取环境变量，站点级边缘函数的文档里又是全局 `env`——我按前者写了 `const { request, env } = context`，结果在部署形态下 `env` 是 `undefined`。而代码里只有 POST 路径会先碰 `env.ALLOWED_ORIGINS`，GET 路径在那之前就返回了——这完美解释了"GET 正常、POST 炸"的诡异不对称。

修复两手一起抓：

```js
// 兼容两种环境变量形态
const readEnv = (context) => {
  if (context?.env && typeof context.env === "object") return context.env;
  if (typeof env !== "undefined" && env) return env;
  return {};
};

// 全局兜底：任何异常都转成 500 + 错误信息，而不是平台层 545
export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (err) {
    return json({ error: `上传服务内部错误：${err?.message}` }, 500, "*");
  }
}
```

**教训**：边缘函数里别让任何异常裸奔到平台层——545 不会告诉你任何事，自己包一层 500 才能看见堆栈。

### 坑二：401——Token 和 authCode 是两种鉴权

545 修完，POST 终于能穿透到图床了，结果图床回 `401 Unauthorized`。

我拿鉴权码直连图床测了两种姿势：放进 `?authCode=` 查询参数 → 401；放进 `Authorization: Bearer` 请求头 → **200**。真相大白：我手里的是图床后台签发的 **API Token**（`imgbed_` 前缀），它只认请求头；`authCode` 查询参数是另一种环境变量式的鉴权码，两者不是一回事。

函数里干脆两个都带上，图床那边任一命中即可通过，以后换哪种凭证都不用改代码：

```js
target.searchParams.set("authCode", E.AUTH_CODE);      // 鉴权码式
headers = { authorization: `Bearer ${E.AUTH_CODE}` };  // API Token 式
```

### 坑三：404 之谜——直连全通，代理必挂

这是最磨人的一关。修复 401 后，三层测试变成了：无 Origin → 403 ✅，带 Origin 缺文件 → 400 ✅，全链路上传 → **图床返回 404** ❌。

诡异在于我用 curl **逐字节复刻**代理的请求——同一个 URL、同样的查询参数、同样的 Bearer 头、同一个文件——直连怎么测都是 200，只有从边缘函数发出去才 404。URL 没错（`res.url` 显示落在 `a.xxx.com/upload`，没有重定向），文件也没错（名字、类型、大小都完好）。

排查手段是把函数的错误响应加厚：图床返回非 2xx 时，把**实际落地路径、原始响应体、收到的文件元信息**全部带回来。加上之后信息还是很干净——那就只剩一个变量了：**请求体本身**。

结论：**EO 运行时对 `FormData` 的 multipart 序列化和标准实现有差异**，序列化出来的报文图床（也是跑在 CF Pages 上）解析不了，解析失败直接 404。既然运行时的 FormData 不可信，就自己按 RFC 拼字节流：

```js
async function buildMultipart(file, filename, fileType) {
  const boundary = `----EOUpload${Date.now().toString(36)}`;
  const head = new TextEncoder().encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${fileType}\r\n\r\n`,
  );
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.byteLength + fileBytes.byteLength + tail.byteLength);
  body.set(head, 0);
  body.set(fileBytes, head.byteLength);
  body.set(tail, head.byteLength + fileBytes.byteLength);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
```

函数里做成自动降级：先用 FormData 转发，非 2xx 就用手搓 multipart 重试一次，再失败才报错。部署完重测，全链路 200，返回 `{"url":"https://tu.xxx.com/file/waline/xxx.png"}`——通了。

**教训**：不同边缘运行时的 Web API 兼容性不能想当然，"标准里应该这样"和"这个运行时实际这样"是两回事。把原始响应体带出来比反复猜快得多。

### 坑四：设计坑——"点发送才上传"的假链接

这个坑是我自己挖的。最初有个想法：图片不要在选的时候就传，等用户**点发送**时再批量上传——这样发评论前删掉的图就不会产生上传。

实现思路：`imageUploader` 立即返回一个假占位链接（形如 `pending://uuid/文件名`），文件暂存内存；再在容器捕获阶段拦截 Waline 的两条提交路径（发送按钮 click 和 Ctrl/Cmd+Enter），拦截后先把内存里的文件全部上传、把编辑器文本里的占位替换成真实链接，最后放行原生提交。

功能上跑通了，但编辑器里从此躺着一个 `pending://` 假链接，怎么看怎么别扭。真正判它死刑的是后来读 Waline 源码时发现的雷：**Waline 会把编辑器草稿存进 localStorage**。如果选完图没发送就刷新页面，草稿恢复出 `pending://` 文本，但内存里的待传文件早没了——此时点发送，占位链接会被**原样发布**，评论区永远显示一个死链。

而读源码的同一时刻也发现：Waline 原生机制早就把"上传中"的体验做全了（占位、锁定、替换、失败处理，见前文）。所谓"点发送才上传"省下的那点体验，撑不起这些假链接和漏洞。于是整个拦截层删掉，回到选图即传，净删近百行。

## 安全与限流的分工

最终函数里只做三件事：**来源白名单、仅图片、大小上限**。用三层 curl 验收：

| 请求 | 预期 | 实测 |
| --- | --- | --- |
| 无 Origin 直传 | 403 | ✅ `Forbidden origin` |
| 白名单 Origin、缺文件 | 400 | ✅ `缺少 file 字段` |
| 白名单 Origin + 图片 | 200 + 展示链接 | ✅ |

按 IP 的速率限制放在 EO 控制台的平台层配置。这条边界画清楚之后，函数代码反而很短——它只做"格式正确的请求才放行"，"请求太多"这种事不是代码该管的。

## 遗留的取舍：孤儿文件

选图即传意味着：图传完了、用户发评论前又把图删了，图床上会留下一个没人引用的文件。此类场景还包括发出后管理员删评论——外链图床本来就不会跟着删。

技术上可以做自动清理：给边缘函数加一个持有图床管理凭证的 DELETE 代理，前端监听编辑器文本、发现上传过的链接被删就调用。但删除凭证比上传凭证敏感得多，前端文本 diff 也容易误伤，为一个低频且无害的事件引入这些，不划算。现状是接受少量孤儿文件落在图床的 `waline/` 目录里，隔段时间在图床后台清一次。

## 小结

- **静态站点里"不能公开的东西"只有一种归宿：服务端。** 哪怕只是一个转发函数。
- **边缘运行时的 Web API 有自己的脾气。** env 的形态、FormData 的序列化，文档说归文档，跑起来验证才算数。
- **把原始报错带回来，是排错效率的分水岭。** 545 之谜如果第一天就能看见 TypeError 堆栈，半小时就结束了。
- **给依赖写 hack 之前，先读它的源码。** Waline 原生的上传体验比我 hack 出来的好，还附赠了发现草稿泄漏雷的机会。
