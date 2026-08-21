---
title: 怎么让 dsh 无限重试
published: 2026-08-21
updated: 2026-08-21
description: dsh 默认只会重试 5 次且间隔很快；本文展示通过配置 retryPolicy 为 always，实现指数退避的无限重试。
image: ''
tags: [dsh, AI, 重试]
category: '运维'
draft: false
lang: 'zh-CN'
slug: zen-me-rang-dsh-wu-xian-zhong-shi
---

## 背景

dsh（DeepSeek Harness）是我常用的 AI 助手 CLI。默认情况下它的 **llm-retry** 插件采用 `normal` 模式，`maxRetries` 为 5，`baseDelayMs` 为 500，导致：

- 前几次重试仅间隔 0.5 s、1 s、2 s…
- 第 5 次仍然失败后直接返回错误，整个会话结束。

在模型频繁出现网络抖动或临时限流时，这种“快速五次”往往不够。

## 错误示例

（省略实际运行日志，示例截图或文字）
> provider "openai" failed, retry 5/5, backoff 2 s → abort

## 正确的做法：配置 `retryPolicy`

### 1. 不要修改 `node_modules`

AI 之前误改了 `@earendil-works/pi-ai/dist/utils/retry.js`，但该文件 **并未被 dsh 调用**，真正的重试策略在 **`@deepseek-ai/dsh-llm-retry`** 中。直接改源码会在升级后被覆盖，且容易产生副作用。

### 2. 在 `~/.dsh/settings.yaml` 中为每个 Provider 添加 `retryPolicy`

```yaml
llm-pi-ai:
  providers:
    nvm:
      displayName: 英伟达
      apiKeyEnv: NVM_API_KEY
      api: openai-completions
      baseURL: https://integrate.api.nvidia.com/v1
      retryPolicy:
        mode: always          # 无限重试
        backoff:
          initialDelayMs: 2000 # 第一次重试 2 s
          maxDelayMs: 30000   # 最大 30 s
          jitterRatio: 0.1    # ±10% 抖动避免“同步雨点”
    modelscope1:
      displayName: 魔搭
      apiKeyEnv: MODELSCOPE1_API_KEY
      api: openai-completions
      baseURL: https://api-inference.modelscope.cn/v1
      retryPolicy:
        mode: always
        backoff:
          initialDelayMs: 2000
          maxDelayMs: 30000
          jitterRatio: 0.1
```

> **mode 说明**
> - `normal`：受 `maxRetries` 限制，默认 5 次。
> - `always`：不受次数限制，只受 `backoff` 最大延迟控制，直至手动中止。

> **backoff 计算**
> `delay = min(initialDelayMs * 2^(retry‑1) * jitter, maxDelayMs)`
> 其中 `jitter` 为 `[1‑ratio, 1+ratio]` 的随机因子，防止多个实例同步重试。

### 3. 保存后直接生效

`dsh` 会在下次请求时读取 `settings.yaml`，无需重新安装或重启。如果你已经运行了 `dsh`，只需要重新发起会话即可看到日志：

```bash
$ dsh conversation -m openai/gpt-4
...
[retry] attempt 1/∞, wait 2.1s
[retry] attempt 2/∞, wait 4.3s
...
```

## 验证

1. **故意让请求超时**（如关闭网络或使用错误的 `baseURL`）。
2. 观察终端输出，确认重试次数持续递增，且延迟随 `2x` 增长直至 30 s。
3. 按 `Ctrl+C` 中断会话，`dsh` 会立刻停止后续重试。

## 注意事项

- **无限重试会消耗配额**。对 **Quota/ Billing** 错误（如 `QUOTA`、`INVALID_CREDENTIAL`）`always` 模式仍会重试，可能导致无限请求并触发封禁。请根据实际需要决定是否使用 `always`，或在 `normal` 模式下自行调高 `maxRetries`。
- 如果只想延长间隔而不想无限循环，可以保留 `mode: normal`，只调大 `maxRetries` 或 `maxDelayMs`。
- 配置错误会在启动时抛出 **Schema validation** 错误，记得检查 `pnpm dev` 或 `pnpm build` 输出的报错信息。

## 小结

- **别改源码**：dsh 的重试逻辑在 `dsh-llm-retry`，通过 `settings.yaml` 完全可配置。
- **用 `retryPolicy.mode: always`** 实现无限重试，配合 `backoff` 参数得到指数退避。
- **手动中止**：`Ctrl+C`（或发送中断信号）随时停止重试，避免不必要的费用。

这样就完成了让 dsh 无限重试的配置，你可以把它当作日常的容错手段，特别是在不稳定网络或临时限流的场景下。祝玩得开心！
