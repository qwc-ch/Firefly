---
title: Linux 上安装和使用 AstrBot
published: 2026-04-25
image: 'api'
updated: 2026-05-31
description: 在 Linux 系统上安装 AstrBot 聊天机器人并做基础设置
tags: [Linux, 教程, Astbot]
category: 'Linux,Astbot'
draft: false
lang: 'zh-CN'
---

## AstrBot 是什么

AstrBot 是一个开源的聊天机器人框架，轻量好用，能对接 QQ、微信、飞书这些平台。自带插件系统和可视化面板，社区里已经有上千款插件了，做自动回复、群管理、定时任务什么的都挺方便的。

## 安装

在 Linux 终端里跑这个脚本就行：

```bash
bash <(curl -sSL https://raw.githubusercontent.com/zhende1113/Antlia/refs/heads/main/Script/AstrBot/Antlia.sh)
```

如果你的系统没装 curl，用 wget 也行：

```bash
wget -qO- https://raw.githubusercontent.com/zhende1113/Antlia/refs/heads/main/Script/AstrBot/Antlia.sh | bash
```

> [!tip]
> 如果 `uv sync` 报错，可以试试设置环境变量：
>
> ```bash
> echo 'export UV_LINK_MODE=copy' >> ~/.bashrc
> source ~/.bashrc
> ```
> 然后正常启动：
> ```bash
> cd AstrBot
> uv run main.py
> ```
> 如果下载依赖时遇到网络问题，可以换成国内镜像源：
> ```bash
> echo 'export UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"' >> ~/.bashrc
> source ~/.bashrc
> ```

[AstrBot 仓库](https://github.com/AstrBotDevs/AstrBot/)

[AstrBot 官方文档](https://docs.astrbot.app/)

[脚本仓库](https://github.com/zhende1113/Antlia/)
