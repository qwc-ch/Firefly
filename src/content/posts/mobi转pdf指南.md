---
title: Mobi 转 PDF 完整指南
description: "用 Calibre 把 MOBI 电子书转换成 PDF 的详细教程，解决排版错乱问题"
published: 2026-09-12
draft: false
tags: ['Calibre', 'MOBI', 'PDF', '电子书', '格式转换']
category: '工具教程'
author: 'Admin'
image: "api"
---

## 前言

MOBI 是 Kindle 的经典格式，但有时候需要转成 PDF 方便在其他设备上阅读。直接转换往往会出现**图片被挤压、页面大片空白**的问题。本文记录了我从实战中总结出的正确转换方法。

## 问题：直接转 PDF 为什么会乱？

用 `ebook-convert` 直接 MOBI → PDF 时，Calibre 会用 QtWebEngine 渲染 HTML 内容，再输出为 PDF。MOBI 文件里的图片通常是窄长的竖版（比如 900×1280），但默认的 PDF 页面是 Letter 尺寸（612×792），渲染时图片就被挤到页面一侧，另一边全是空白。

```
❌ 错误效果：
┌──────────────┐
│              │
│   [图片]     │  ← 图片只占右边，左边大片空白
│              │
└──────────────┘
```

## 解决方案：MOBI → EPUB → PDF

核心思路是分两步走：先转 EPUB 提取原始图片，再用 Python/PIL 从图片生成 PDF，这样可以保持原始宽高比。

### 第一步：安装 Calibre

```bash
sudo apt-get install -y calibre
```

如果你遇到依赖问题，可以先修复：

```bash
sudo apt-get install -f
```

### 第二步：MOBI → EPUB

```bash
QTWEBENGINE_DISABLE_SANDBOX=1 ebook-convert "输入.mobi" "/tmp/输出.epub"
```

> **注意**：加上 `QTWEBENGINE_DISABLE_SANDBOX=1` 可以避免在无头环境中崩溃。

### 第三步：从 EPUB 提取图片生成 PDF

EPUB 本质是一个 ZIP 包，里面包含所有图片。用 Python 脚本逐页提取：

```python
import zipfile, os
from PIL import Image
import io

with zipfile.ZipFile("输出.epub") as z:
    imgs = sorted([n for n in z.namelist() if n.endswith(('.jpg','.jpeg','.png'))])
    pil_images = [Image.open(io.BytesIO(z.read(n))).convert('RGB') for n in imgs]
    pil_images[0].save("输出.pdf", 'PDF', save_all=True, append_images=pil_images[1:], resolution=150.0)
```

这样生成的 PDF 每一页都对应一张原始图片，**比例不会变形，不会出现空白边距**。

### 批量处理脚本

如果有多个文件，可以写个循环：

```bash
cd "mobi文件夹"
for f in *.mobi; do
  QTWEBENGINE_DISABLE_SANDBOX=1 ebook-convert "$f" "/tmp/$(basename "$f" .mobi).epub" 2>/dev/null
  python3 -c "
import zipfile, os
from PIL import Image
import io
epub = '/tmp/$(basename "$f" .mobi).epub'
pdf = '$f'.replace('.mobi', '.pdf')
with zipfile.ZipFile(epub) as z:
    imgs = sorted([n for n in z.namelist() if n.endswith(('.jpg','.jpeg','.png'))])
    pil = [Image.open(io.BytesIO(z.read(n))).convert('RGB') for n in imgs]
    pil[0].save(pdf, 'PDF', save_all=True, append_images=pil[1:], resolution=150.0)
    print(f'{pdf}: {len(pil)} pages')
"
done
rm -f /tmp/*.epub
```

## 实际效果

我用这套方法转换了《金牌得主》的 12 本 MOBI（共约 2300 页），每本 PDF 都完美保持了原图比例，没有变形也没有空白边距。

| 转换方式 | 效果 |
|---------|------|
| ebook-convert MOBI→PDF | 图片挤在一边，大片空白 |
| MOBI→EPUB→PDF（图片提取） | 原比例呈现，排版正常 |

## 总结

1. **不要直接用 `ebook-convert` 转 PDF**，渲染引擎会破坏图片比例
2. **走 MOBI → EPUB → 提取图片 → PDF** 的路线
3. 安装 Calibre 时加上 `QTWEBENGINE_DISABLE_SANDBOX=1` 环境变量
4. 用 Python PIL 库从 EPUB 提取图片生成 PDF，保留原始分辨率

这个方法适用于漫画、杂志等以图片为主的 MOBI 文件。如果是纯文字 MOBI，直接转换也问题不大。
