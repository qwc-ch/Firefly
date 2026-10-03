---
title: dsh-fs-link2symlink-fix：一个插件修好 dsh 在 PRoot 下 write 丢文件
published: 2026-10-03
updated: 2026-10-03
description: dsh 的 write 工具在 Termux/PRoot 里新建文件只留一个悬空的 .l2s 符号链接，内容直接蒸发。排查到 PRoot 的 --link2symlink 把 link(2) 仿真坏了，于是写了个零依赖插件在发布原语上把它兜住。
image: 'api'
tags: [dsh, AI, 插件, 开源]
category: '开源'
draft: false
lang: 'zh-CN'
slug: dsh-fs-link2symlink-fix
---

## 症状：工具说写好了，文件没了

这台机器上的 dsh 跑在 Termux + PRoot 容器里。某天开始，用 `write` 工具**新建**文件会变成这样：

```console
$ ls -la
lrwxrwxrwx hello.txt -> .../.hello.txt.<pid>.<uuid>.tmpdir/.l2s.hello.txt.tmp0001
$ cat hello.txt
cat: hello.txt: No such file or directory
```

工具那边返回的是干干净净的 `Created file`，磁盘上却是一个**悬空的 `.l2s.` 符号链接**，内容已经不存在了。

几个很明确的特征：

- **只有新文件会丢**。覆盖已有文件、`edit` 改文件都完全正常。
- 目录里会残留 `.l2s.*` 文件和 `.<name>.<pid>.<uuid>.tmpdir/` 目录。
- 全程没有任何报错，就是文件"凭空消失"。

最黑色幽默的一次：我给这个修复插件写的 4 个源文件（`index.js`、`package.json`、`cordis.patch.yml`、`README.md`）**就是用 `write` 工具创建的，全部变成了悬空链接**。最后只能退回 `cat > file <<'EOF'` 用 bash 重新写了一遍。这个自证比任何复现脚本都有说服力。

## 定位：`.l2s` 到底是谁

顺着文件名查，dsh 自己的代码里根本搜不到 `l2s` 这个词。真正的来源是容器的启动方式：

```bash
proot --change-id=1001:1001 --pwd=/home/qwc \
      --rootfs=.../ubuntu-noble_arm64 \
      --link2symlink ...        # ← 就是它
```

`--link2symlink` 是 Termux/TMOE 系 PRoot 的一个扩展：Android 的存储上经常建不了真硬链接，于是 PRoot 拦截 `link(2)`，用**符号链接来仿真硬链接**。

所以 `.l2s.` = **link to symlink**。这个名字既是线索也是答案。

## 元凶：新建文件走的是硬链接

dsh 的本地文件系统后端 `@deepseek-ai/dsh-fs-local`，在 `writeFileAtomic` 里对**新建文件**和**覆盖文件**用了两种不同的发布方式：

```js
// dsh-fs-local/lib/index.js（节选）
const stagingDir = join(directory, `.${basename(absolutePath)}.${pid}.${uuid}.tmpdir`);
const tempPath = join(stagingDir, `${basename(absolutePath)}.tmp`);
// ...写入 tempPath、sync、chmod...

if (createIfAbsent !== void 0) await linkFile(tempPath, absolutePath); // ← 新建文件：硬链接
else await rename(tempPath, absolutePath);                             // ← 覆盖/编辑：rename

await removeStagingDir(stagingDir);   // 删掉整个 staging 目录
```

设计意图很清楚：先在自己的 staging 目录里把内容写完整、同步好，然后用 `link()` 一步"无覆盖地"发布出去——如果目标已存在，`link()` 会抛 `EEXIST`，dsh 再把它翻译成 `FS_NOT_OBSERVED`。这是很标准的原子 no-replace 写法。

但在 `--link2symlink` 下，`link()` 不再是硬链接，而是变成了一个符号链接代理：

```text
link(temp, target)
   └─ target -> <stagingDir>/.l2s.temp0001 -> <stagingDir>/.l2s.temp0001.0001

removeStagingDir(stagingDir)
   └─ 代理文件被一起删掉 → target 悬空，内容不可恢复
```

代理文件就放在 staging 目录**里面**，而 dsh 紧接着就把整个 staging 目录删了。于是：写成功、文件"在"、内容没了。

覆盖面没事，是因为 `rename()` 是真的把文件移出 staging 目录，PRoot 处理得好好的。**所以这个 bug 精确地只发生在"新建"这一条路径上。**

## 为什么不能"事后修复悬空链接"

我一开始的想法也是写个脚本扫描 `.l2s` 悬空链接去还原。但看清楚链路后就知道这条路走不通：内容在 `removeStagingDir` 那一刻就已经随着代理文件被删除了，等你在文件系统上看到悬空链接时，字节早没了。

**修复必须发生在"发布"这一步之前**，而不是之后。

## 修复：换掉发布原语，而不是改 dsh

顺着代码往下看，`writeFileAtomic` 其实留了一个口子：

```js
const linkFile = internals.linkFile ?? link;   // internals 优先，否则用内置 link
...
await linkFile(tempPath, absolutePath);
```

`internals` 是 `LocalFileSystem` 实例上的一个对象，而 `dsh-fs-sandbox` 的 `SandboxedFileSystem` 直接继承它——也就是说，只要拿到 `ctx.fs` 这个服务实例，把 `internals.linkFile` 换掉，两种后端就一起覆盖了，**dsh 本体一个字节都不用改**。

插件的做法分三步：

1. **加载时探测**。在临时目录里原样复刻 dsh 的发布序列，看结果：

   ```js
   await writeFile(source, PROBE_CONTENT, { mode: 0o600, flag: "wx" });
   await nativeLink(source, target);
   await rm(staging, { recursive: true, force: true });   // dsh 也会删 staging
   const observed = await readFile(target, "utf8");        // PRoot 下这里 ENOENT
   ```

2. **可信就完全不动**。普通 Linux/macOS 上硬链接是好的，探测通过，保留原生 `link()`，行为零变化。

3. **不可信才替换**。用"独占创建 + 内容拷贝"来等价实现硬链接的语义：

   ```js
   const handle = await open(targetPath, "wx", mode & 0o7777); // EEXIST = 竞争失败，语义不变
   await handle.writeFile(await readFile(sourcePath));
   await handle.sync();
   ```

   - `open(..., "wx")` 保住了 no-replace：并发创建者依然会拿到 `EEXIST`，dsh 依然把它翻成 `FS_NOT_OBSERVED`，和原生行为一致；
   - 内容从 staging 文件里拷出来，不再依赖 staging 目录活到发布之后；
   - staging 文件的权限位被保留，新文件落地的权限和 dsh 原本的选择一样（实测都是 `0600`）。

探测只跑一次，之后每次发布都 `await` 同一个 promise；安装又是同步完成的，所以不存在"探测还没结束就漏一次写"的窗口。

## 安装

插件零运行时依赖，`index.js` 只用 Node 内置模块。两种装法：

**方式 A：绝对路径（推荐给容器/离线环境）**——在 `~/.dsh/profiles/web/cordis.patch.yml` 里插一行：

```yaml
- insert:
    - id: fs-link2symlink-fix
      name: /absolute/path/to/dsh-fs-link2symlink-fix/index.js
```

profile 配了 `patchReload: "live"`，**保存即热重载**，不用重启 dsh；也不经过 pnpm，`pnpm install` 不会把它清掉。

**方式 B：当 bundle 装**：

```bash
dsh plugin --profile web add github:qwc-ch/dsh-fs-link2symlink-fix
# 再把它加进 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles
```

## 验证

新建文件之后：

```bash
ls -la  <new-file>     # 应该是 -rw-------，不是 lrwxrwxrwx
cat     <new-file>     # 内容完整
find . -name '.l2s.*'  # 没有残留
```

插件加载时会打一行日志说明走了哪条分支，比如这台机器上是：

```text
fs-link2symlink-fix: link() unusable (ENOTEMPTY); publishing new files by exclusive-create copy
```

健康主机上则是 `native hard link survived staging removal; native link publication retained`。

我这边除了新建，还顺手验证了嵌套目录、并发新建、覆盖回归、`edit` 回归，以及补充的单测（真实文件 / 非 symlink / 内容 / `0600` 权限 / 竞争时 `EEXIST` / 停用回滚），都过了。

## 几个注意点

- **`internals.linkFile` 是测试接缝，不是正式公开 API。** 这是"不 fork dsh 又要修部署环境问题"的务实选择。插件对"接缝不存在"的情况做了安全降级（直接什么都不做），但如果哪天上游把它删了，插件会静默失效——那时候最好去上游提个 issue。
- **探测失败一律保守兜底。** 连临时目录都建不了、或者 `link()` 直接报错，都会被判定为"不可信"，改用拷贝发布。对"文件创建正确性"来说，这是更安全的一侧。
- **会话日志的 `.l2s` 垃圾不在覆盖范围。** `dsh-session-persistence-jsonl` 落盘时也用了 `link()`，会在 `~/.dsh/sessions/**` 留 `.l2s.*` 文件。但它**不会丢日志**（日志随后会被 `rename` 落成普通文件），只是碍眼，所以插件没去动会话目录。
- **覆盖/编辑故意不动。** 那两条路径本来就正常，没必要扩大改动面。

## 仓库

源码在 GitHub：[qwc-ch/dsh-fs-link2symlink-fix](https://github.com/qwc-ch/dsh-fs-link2symlink-fix)，MIT 协议，就 `index.js` / `package.json` / `cordis.patch.yml` 加一份 README，看完就知道没藏东西。

如果你也在 Termux/PRoot 里跑 dsh，而且发现"新建的文件过一会儿就没了"，八成是同一个坑——`ls -la` 看一眼是不是 `lrwxrwxrwx` 指向 `.l2s.*` 就知道了。

说真的，我挺想在手机上认真玩一玩 vibe coding，但折腾下来还是觉得 opencode 这类项目更完善。不过手机终归只能玩一玩，不适合拿来实战。
