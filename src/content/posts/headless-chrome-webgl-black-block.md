---
title: "headless Chrome 截图 WebGL 黑块问题排查"
published: 2026-08-14
draft: false
description: "友链截图工具在 headless Chrome 下遇到 Spline/Live2D 站点渲染失败、出现带报错信息的黑块，通过启用 swiftshader 软件渲染解决。"
tags: ['selenium', 'WebGL', 'headless', '截图']
category: '运维'
lang: 'zh-CN'
author: 'Admin'
---

## 起因

维护友链检测工具 [check-flink](https://github.com/fqzlr/check-flink)（Selenium + headless Chrome 截取友链主页并上传图床）时发现：部分友链站点使用了 [Spline](https://spline.design/) 或 Live2D 这类 WebGL 内容，截出来的图对应区域是一块纯黑色，黑块里还带着 WebGL 初始化失败的报错信息，非常难看。

## 原因分析

headless Chrome 在无 GPU 环境下默认禁用 WebGL 渲染。站点通过 WebGL 绘制的 3D/动画内容无法初始化，页面就只剩下一块黑色区域（有时带报错提示）。之前截图工具的 Chrome 启动参数里是 `--disable-gpu`，等于直接关掉了 GPU 相关的所有能力。

## 解决方案

Chrome 支持通过 **SwiftShader** 做 WebGL 的软件渲染——没有 GPU 也能用 CPU 模拟渲染出 WebGL 内容。改动 `screenshot.py` 里的 Chrome 启动参数：

```python
options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
# WebGL 软件渲染（Spline/Live2D 等 WebGL 内容在 headless 下默认不渲染，产生黑块）
# 新版 Chrome 需要 --enable-unsafe-swiftshader 才允许软件 WebGL
options.add_argument("--use-gl=angle")
options.add_argument("--use-angle=swiftshader")
options.add_argument("--enable-unsafe-swiftshader")
options.add_argument("--ignore-gpu-blocklist")
options.add_argument("--disable-extensions")
options.add_argument("--disable-software-rasterizer")
options.add_argument(f"--window-size={WINDOW_WIDTH},{WINDOW_HEIGHT}")
```

关键点：

- 移除 `--disable-gpu`，它会把 GPU 相关能力整个关掉
- `--use-gl=angle` + `--use-angle=swiftshader`：ANGLE 层之上跑 SwiftShader 软件实现
- `--enable-unsafe-swiftshader`：**新版 Chrome 的必需参数**，没有它软件 WebGL 依然不允许启用
- `--ignore-gpu-blocklist`：忽略对软件渲染器的黑名单限制

## 验证

改完后对含 WebGL 内容的友链站点重新截图，Spline / Live2D 内容可以正常渲染，黑块消失。磁盘没有独立 GPU 的 CI 环境（GitHub Actions / 国内流水线）同样适用。

## 备注

- 该修复已通过 PR 提交到上游项目：[check-flink](https://github.com/fqzlr/check-flink)
- 此方案是"尽力"渲染：个别站点可能仍有兼容性问题，必要时可再叠加截图后黑区检测兜底
- 如果遇到 WebGL 内容加载慢，可适当调大截图前的等待时间（`PAGE_LOAD_WAIT`）