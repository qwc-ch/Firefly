---
title: 无服务器部署 AstrBot：Hugging Face 免费方案
published: 2026-08-18
description: 把 AstrBot + NapCat 整套机器人塞进 Hugging Face 免费 Docker Space，零服务器成本，配合 GitHub 自动备份防止数据丢失，再加一个 Actions 定时请求防休眠
tags: [教程, AstrBot, 无服务器, HuggingFace]
category: 'Astbot,无服务器'
draft: false
lang: 'zh-CN'
slug: serverless-astbot-huggingface
---

之前写过一篇在 Linux 上装 AstrBot 的，那是跑在自己机器上的路子。但不是每个人都有台长期开机的服务器，为一个小机器人掏 VPS 的钱也有点舍不得。后来试了试把整套东西塞进 Hugging Face 的免费 Docker Space，跑通之后感觉还挺合适，顺手记录一下。

用的还是社区现成的方案：[Astrbot-Napcat-huggingface](https://github.com/MoYangking/Astrbot-Napcat-huggingface)，把 AstrBot（聊天机器人框架）和 NapCat（QQ 桥接）打包在一个 OpenResty 网关下面，supervisord 管进程，适配 HF 的 Docker SDK。我也是第一次搞 HF Space，中间踩了几个坑，都写在最后了。

动手之前有两个事得先想清楚，不然后面容易后悔：

一是免费版的 Space 四十八小时没人访问就会休眠，休眠的时候机器人是离线的。后面有办法用 GitHub Actions 定时"续命"，但你要接受偶尔冷启动慢几秒到几分钟。

二是容器本身的磁盘是临时的，一重启就什么都没了。所以数据备份不能靠容器，得靠项目自带的 Sync 守护进程，把数据定时推到你的 GitHub 仓库。这个配好了才谈得上不丢数据。

## 第一步，建个 Space

打开 https://huggingface.co/new-space，名字随便起，SDK 记得选 Docker，不想被别人看到就勾 Private。建好之后可以去 Settings 里看一眼，免费的 CPU 档有个自动休眠的选项。

## 第二步，把代码推上去

如果你本地已经有这个仓库，不用 clone 过去再拷文件，直接加一个远端就能推：

```bash
git clone https://github.com/MoYangking/Astrbot-Napcat-huggingface.git
cd Astrbot-Napcat-huggingface

git remote add hf https://<你的HF用户名>:<HF_TOKEN>@huggingface.co/spaces/<用户名>/<Space名>
git push --force hf main
```

Token 在 https://huggingface.co/settings/tokens 生成，权限选 Write 就行。

推完之后去 Space 页面点 Build，第一次构建大概二十分钟到四十分钟，别急着刷新，等它自己跑完。

## 第三步，配置备份

在 Space 的 Settings → Variables and secrets 里加两个变量：

| 变量 | 值 | 干什么用的 |
| --- | --- | --- |
| `GITHUB_REPO` | `你的GitHub用户名/备份仓库名` | 数据推到哪 |
| `GITHUB_PAT` | `ghp_...` | 推数据用的凭据 |

前提是你得先在 GitHub 建一个空的 Private 仓库，比如叫 `astrbot-backup`，PAT 在 https://github.com/settings/tokens 生成，勾上 repo 权限。

填完之后 Space 会自动重启。Sync 守护进程会把 `AstrBot/data/` 每三分钟往备份仓库推一次，先 pull 再 commit 再 push，两边不会打架。这一对变量不配也能跑，但容器一重启数据就没了，到时候懂的都懂。

## 第四步，第一次登录

访问 `https://<space名>.hf.space/`，有几个入口：

- `/` 是 AstrBot 控制台。新版首次登录账号固定是 `astrbot`，密码是随机生成打印在日志里的，去运行日志里搜 `Initial password` 就能看到。
- `/admin/ui/` 是路由管理，默认密码 `admin`，建议进去改掉。
- `/webui/` 是 NapCat 的界面，个人 QQ 号扫码登录用的，只用腾讯官方机器人可以跳过。

## 第五步，防休眠

免费档四十八小时没访问就休眠，所以要定时去"戳"它一下。在仓库里加个 workflow，GitHub Actions 会替你每天戳三次：

```yaml
# .github/workflows/keep-alive.yml
name: Keep HF Space Alive
on:
  schedule:
    - cron: "0 */8 * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -sS -o /dev/null -H "Authorization: Bearer ${{ secrets.HF_TOKEN }}" https://<你的space名>.hf.space/
```

然后在仓库的 Settings → Secrets → Actions 里加一个 `HF_TOKEN` 就行。一天三次请求，Actions 的免费额度完全够用。

## 一些要提前知道的局限

| 方面 | 实际情况 |
| --- | --- |
| 数据 | 有 GitHub 兜底，但两次备份之间的三分钟如果正好被硬杀，会丢一点东西 |
| 在线率 | 免费版休眠后唤醒要一两分钟；想真正 7×24 在线得花钱，大概七美元多一个月 |
| 资源 | CPU Basic 是 2 vCPU / 16GB 单副本，别指望它扛并发 |
| 构建 | 改一次 Dockerfile 就要重新构建，二十分钟起步 |

## 踩过的坑

第一个是 `FROM ubuntu:latest`，六月份之后 latest 已经指向 26.04 了，OpenResty 的 apt 源还没跟上，构建直接 404 失败。改成 `FROM ubuntu:24.04` 就好了。

第二个是浏览器打开 404。Space 第一次启动会下载两百来兆的 AstrBot 前端资源，下载没完成之前 `/` 就是 404，等下载到 100% 刷新一下就好，不是坏了。

第三个是没配备份那一对变量的话，AstrBot 和 NapCat 会卡三十分钟起不来——Sync 守护进程拿不到配置会崩，标记文件永远不写，其他服务就干等超时。我给守护进程加了"没配置就直接放行"的处理，已经合到仓库里了。

总的来说，无服务器方案的核心矛盾就是拿在线率换零成本。这套路子数据有 GitHub 兜底，唯一的妥协是休眠后的冷启动，对个人机器人来说这个妥协还算能接受。