---
title: "koffi 在 Alpine 上直接 abort：一次 musl 预编译排查"
published: 2026-11-15
image: 'api'
description: "dsh 在 Alpine aarch64 上一调用工具就整个进程 abort。根因是 koffi 3.1.1 优先加载 glibc 预编译二进制，在 musl 上进入 C++ 初始化后直接终止，musl 回退逻辑根本没机会执行。本文记录排查过程、修复思路和修复仓库。"
tags: [koffi, musl, Alpine, Node.js, dsh]
category: '运维'
draft: false
lang: 'zh-CN'
slug: koffi-musl-alpine-abort
author: 'Admin'
---

## 起因

我的 dsh（DeepSeek Harness）跑在 Alpine Linux edge 上，环境是Node 24。dsh web 能正常启动，页面上问一句「4+4 等于几」也能正常回答，看起来一切正常。

但只要让它干点需要调用工具的活，比如执行一条 shell 命令，整个进程就会突然消失。日志里只有这么几行：

```text
terminate called after throwing an instance of 'std::system_error'
  what():  No error information
Aborted (core dumped)
```

退出码 134，也就是 `SIGABRT`。不是 JavaScript 异常，不是 unhandled rejection，是 C++ 层直接把进程终止了。

## 定位：问题出在 koffi

dsh 的本地子进程执行器 `dsh-subprocess-local` 用 [koffi](https://koffi.dev/) 绑定 libc 的 `execve`、`fcntl` 等函数。koffi 是一个 Node.js 的 FFI 库，底层是原生 `.node` 模块。

先排除 dsh 本身的干扰，直接写一个最小复现：

```bash
node -e "require('koffi')"
```

同样 abort。再试试显式加载 musl 版本：

```bash
node -e "require('/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@koromix/koffi-linux-arm64/musl_arm64/koffi.node')"
```

这次正常加载，没有崩溃。

问题范围一下就缩小了：**musl 预编译二进制是好的，坏的是加载路径。**

## 为什么回退逻辑没生效

koffi 3.1.1 的平台包 `@koromix/koffi-linux-arm64` 里同时放了两个预编译二进制：

| 目录 | 目标 C 库 |
| --- | --- |
| `linux_arm64/koffi.node` | glibc |
| `musl_arm64/koffi.node` | musl |

它的加载器逻辑非常直接：

```js
let native = null;
let err = null;
if (native == null) {
  try {
    native = require("./linux_arm64/koffi.node");
  } catch (e) {
    err = e;
  }
}
if (native == null) {
  try {
    native = require("./musl_arm64/koffi.node");
  } catch (e) {
    err = e;
  }
}
if (native == null)
  throw err;
module.exports = native;
```

设计意图是「先试 glibc，失败再试 musl」。问题在于：**在 musl 上，glibc 版本不是抛一个普通的 JavaScript 异常，而是直接把进程 abort 掉。**

`dlopen` 这一关它居然过了，然后进入 C++ 静态初始化，抛出 `std::system_error`，errno 还是 0。异常没人接，`std::terminate` 被调用，进程结束。加载器里的 `catch` 永远等不到执行机会。

也就是说，这段回退逻辑在 Alpine 上形同虚设：第一个 `require` 不是「失败」，是「同归于尽」。

后来查 koffi 的更新记录，3.3.8 已经改成先检测 libc 再选择预编译二进制。但 dsh 0.2.2-rc.1 固定依赖的是 `koffi@3.1.1`，所以这个问题在旧版本上依然存在。

## 修复思路：在加载之前改道

既然不能等 `require` 失败，那就别让它去碰 glibc 版本。思路很简单：

```text
.../linux_<abi>/koffi.node  ->  .../musl_<abi>/koffi.node
```

在 Node 真正打开文件之前，把请求重定向到 musl 兄弟目录。

这个改动需要同时覆盖两个入口：

1. `Module._load`：koffi 加载器用的是相对路径 `require("./linux_arm64/koffi.node")`，会先经过这里；
2. `process.dlopen`：Node 把 `.node` 请求解析成绝对路径后，最终从这里进入原生加载。

两个钩子都只做一件事：命中 `linux_<abi>/koffi.node` 时，检查同级的 `musl_<abi>/koffi.node` 是否存在；存在就替换，不存在就原样放行。

核心匹配逻辑大概是这样：

```js
const GLIBC_PREBUILD = /(^|[\\/])linux_([a-z0-9_]+)[\\/]koffi\.node$/i

export function muslSibling(path) {
  if (typeof path !== 'string' || !GLIBC_PREBUILD.test(path)) return undefined
  return path.replace(GLIBC_PREBUILD, '$1musl_$2/koffi.node')
}
```

libc 检测没有去读 `/etc/os-release`，也没有 spawn `ldd`，而是用了 Node 自带的诊断报告：

```js
const header = process.report.getReport().header
const isMusl = header.glibcVersionRuntime === undefined
```

Node 只在 glibc 主机上设置 `glibcVersionRuntime`，所以这个字段缺失就可以判断为 musl。拿不到报告时宁可保持不启用，也不猜。

整个修复是保守的：

- 只在 Linux 上启用；
- 只在 musl 上启用；
- 只改写 koffi 的 `linux_<abi>/koffi.node`；
- 只有 musl 兄弟文件确实存在才改写；
- 其他平台、其他模块、其他路径完全不动。

## 实际效果

修好之后，dsh web 启动时会多一行日志：

```text
koffi-musl-fix: musl host detected; koffi will use its musl prebuild
```

再让它执行 shell 命令，子进程正常启动，工具调用正常返回，`dsh web` 进程也不再退出。

这个修复没有改 `node_modules`，也没有替换任何二进制文件。它只是在当前进程里改写了模块加载路径，所以 dsh 升级后不会留下烂摊子；如果哪天真升级到已经修复 libc 检测的 koffi，插件也可以直接卸掉。

## 怎么用

项目地址：

**[qwc-ch/dsh-koffi-musl-fix](https://github.com/qwc-ch/dsh-koffi-musl-fix)**

它既可以作为 dsh 插件安装，也可以作为普通的 Node 预加载模块使用。

### 作为 dsh 插件

包内已经带了标准 dsh bundle 元数据：

```json
"dsh": {
  "bundle": {
    "patch": "./cordis.patch.yml"
  }
}
```

bundle 层就是插入一行插件：

```yaml
- insert:
    - id: koffi-musl-fix
      name: dsh-koffi-musl-fix
```

npm 包还没正式发布，目前可以直接从仓库安装：

```sh
# 从 Git 安装
dsh plugin --profile web add git+https://github.com/qwc-ch/dsh-koffi-musl-fix.git

# 或者从本地 checkout 安装
dsh plugin --profile web add /path/to/dsh-koffi-musl-fix
```

安装后重启 dsh。`dsh plugin` 需要 pnpm（或启动器提供的包管理器）。

### 手动挂 home 级补丁

如果不想走 bundle 安装，也可以直接挂本地目录：

```yaml
# ~/.dsh/cordis.patch.yml
- insert:
    - id: koffi-musl-fix
      name: ./plugins/dsh-koffi-musl-fix/index.mjs
```

`~/.dsh/cordis.patch.yml` 里的路径相对于 `~/.dsh/`。确认配置解析到了：

```sh
dsh --profile web --dump-config | grep -A2 koffi-musl-fix
```

### 作为 Node 预加载

不跑 dsh、只是自己的 Node 项目里用了旧版 koffi，也可以直接预加载：

```sh
npm install dsh-koffi-musl-fix
NODE_OPTIONS="--import dsh-koffi-musl-fix/preload" node app.mjs
```

预加载必须在 koffi 第一次 `require` 之前执行。用本地 checkout 的话：

```sh
node --import ./preload.mjs app.mjs
```

### 编程方式

```js
import { install } from 'dsh-koffi-musl-fix/core'

const fix = install({
  onRedirect({ kind, from, to }) {
    console.error(`koffi-musl-fix: ${kind} ${from} -> ${to}`)
  },
})

// fix.active     当前不是 Linux/musl 时为 false
// fix.redirected 已改写的请求数量
// fix.uninstall() 恢复原始加载钩子
```

同样要在第一次 `require('koffi')` 之前调用。

## 适用范围和限制

这个补丁不是万能药：

- 只适用于旧版 koffi 的 `linux_<abi>/koffi.node` / `musl_<abi>/koffi.node` 目录结构，koffi 换布局就失效；
- 只修 koffi，不是其他原生模块的通用方案；
- 如果依赖范围允许，**优先升级 koffi**，3.3.8 之后已经不需要这个 workaround；
- 测试环境是 Alpine edge / aarch64、Node 24、koffi 3.1.1、dsh 0.2.2-rc.1，其他 musl 发行版理论上同理，但没有逐个验证。

## 仓库

代码、测试和完整文档都在这里：

- GitHub：<https://github.com/qwc-ch/dsh-koffi-musl-fix>
- 入口：`index.mjs`（dsh/Cordis 插件）、`preload.mjs`（Node 预加载）、`lib/core.mjs`（无框架核心逻辑）
- 测试：`node --test`，覆盖路径映射、相对/绝对请求改写、dlopen 改写和 musl 检测

如果你也在 musl 上跑 dsh，或者被旧版 koffi 坑过，可以去仓库看看。遇到别的原生模块在 musl 上的类似问题，也欢迎开 issue 交流。
