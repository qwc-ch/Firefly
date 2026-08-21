---
title: dsh-toolcall-id：一个插件修好 dsh 的历史加载失败
published: 2026-08-21
description: dsh Web GUI 重开多步会话时报 "received more than one start Match"，排源发现是工具调用 id 每步重号撞车。写了个开源插件挂在官方钩子上修掉它，升级 dsh 不会被覆盖
image: ''
tags: [dsh, AI, 插件, 开源]
category: '开源'
draft: false
lang: 'zh-CN'
slug: dsh-toolcall-id
---

## 症状

在 dsh 的 Web GUI 里重新打开一个跑过多步工具调用的会话，顶部会冒出一行：

```
历史加载失败：conversation Context 9:tool-callread:0 received more than one start Match（internal）
```

会话本身当时是跑好的，消息也都在，就是重新加载历史的时候整个回放失败。触发条件很明确：**同一个会话里有多个 step 调了工具**，比如 AI 连续 read 了 3 个文件。

## 元凶：工具 id 每一步都重新编号

把会话存档（`~/.dsh/sessions/` 下的 jsonl）解压看事件流，原因很简单：

- 我用的 NVIDIA（openai-completions 协议）这条链路，工具调用 id 是**每个 step 重新从 `read:0` 开始编**的。step 3 有个 `read:0`，step 4 又来一个 `read:0`，step 5 还是 `read:0`。
- 而 dsh 的回放器（`dsh-client-ui-conversation` 里的 `toolDefinition`）拿裸 `callId` 当上下文的 key：

```js
if (event.type === "tool/call")
	return { id: String(event.data.callId), role: "start" };
```

key 里**不带 turn/step 隔离**。回放时第二个 step 的 `read:0` start 撞上同一个 key，`dsh-client-runtime` 直接抛 `received more than one start Match`。

我下载对比了最新的 `0.1.1-rc.1`，这段代码一模一样，上游还没修；项目也不收 issue，那就自己解决。

## 为什么做成插件，而不是改源码

之前让 AI 改 `node_modules` 里的文件翻过车（改了半天发现改的是死代码，没被执行，而且一升级就丢）。所以这次的要求是：

1. **不碰 dsh 自身代码**，升级 dsh 后修复要还在；
2. 用官方留的口子，不 hack。

dsh 正好满足：profile 目录（`~/.dsh/profiles/web/`）支持自己的 bundle 插件，由 pnpm 管理，而且 LLM 流上有一个 `llm/stream` 瀑布钩子——官方的 `session-checkpoint-policy` 就是用这个钩子在流前面插队的。插件连 `dsh` 本体的一个字节都不用改。

## 插件怎么修的

思路一句话：**让 id 在流进会话之前就唯一**。挂在 `llm/stream` 上包住下游流，按会话记录已经用过的工具 id，撞号时重写：

```
第 1 个 step:  read:0  →  read:0    （原样放行）
第 2 个 step:  read:0  →  read:0~1  （发现本会话用过，加后缀）
```

改写发生在**流层**，而会话里的所有东西——拼好的 assistant 消息、持久化的 `tool/call` / `tool/result` 事件、下一次发给模型的请求——全都是从这条流往下游组装的，所以**一处改写，全链路一致**，不存在改写只改了显示层的半吊子状态。

核心代码就这么点：

```js
ctx.on("llm/stream", (options, next) => {
	const state = stateFor(options.sessionId);      // 每个 session 一份已用 id 表
	return wrapStream(state, next());               // yield* 包一层，撞号就改名
}, { global: true });                              // global: true 连 subagent 一起覆盖
```

- `tool-call-delta` chunk：撞号时浅拷贝一份换掉 id
- `block-end` 里的组装好的 block：同样换 id
- 其他 chunk：原样透传
- id 本身唯一的（比如 Anthropic 链路的 `toolu_xxx`）：零改动，零开销

## 安装

```bash
# 1. 装到 web profile
dsh plugin --profile web add github:qwc-ch/dsh-toolcall-id

# 2. 把它加进 bundle 列表：编辑 ~/.dsh/profiles/web/package.json，
#    dsh.profile.bundles 数组末尾加上 "dsh-toolcall-id"
```

然后重启 `dsh web` 就生效了。配置对不对可以随时用 `dsh --profile web --dump-config` 确认树里有它。

要卸载的话：`dsh plugin --profile web uninstall dsh-toolcall-id`，再把 bundle 列表里那行删掉。

## 注意点

- **只防新坑**：修复对插件安装之后产生的会话生效。已经被写坏的旧会话存档里重号已经落盘，救它需要回头改存档（把旧 jsonl 里的重复 id 一次性改写再重新压缩），不是插件的活。
- 插件会让重号 id 变成 `read:0~1` 这种形式，这个 id 同样会进下一次请求的上下文，模型侧不受任何影响（OpenAI 协议本就是靠 id 自匹配的，格式随便）。
- 如果哪天上游修了（key 带上 turn/step），这个插件可以直接卸掉，行为完全等效。

## 仓库

源码在 GitHub：[qwc-ch/dsh-toolcall-id](https://github.com/qwc-ch/dsh-toolcall-id)，MIT 协议，就三个文件（`index.js` / `package.json` / `cordis.patch.yml`），看完就知道没藏东西。

碰到一样报错的，装完记得重启 dsh。
