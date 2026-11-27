---
title: "从平台托管到自建 VPS：用 GitHub Actions 构建并部署 Firefly"
published: 2026-11-27
description: "记录把 Firefly 静态博客从 Vercel / EdgeOne 等平台迁到自建 VPS 的完整过程：GitHub Actions 构建、SSH 密钥、rsync 上传、原子切换、宝塔面板配置、DNS 解析，以及一路踩过的坑。"
image: 'api'
tags: ['部署', 'GitHub Actions', 'VPS', '宝塔', '排错']
category: '部署'
draft: false
lang: 'zh-CN'
author: 'Admin'
slug: github-actions-deploy-vps
---

## 背景

这个博客之前一直部署在 Vercel、EdgeOne、Cloudflare 等平台上。平台托管很省心，但想把站点迁到自己的 VPS 上，核心思路其实很简单：

> Firefly 是纯静态站点，CI 里 `pnpm run build` 生成 `dist/`，然后把这个目录上传到 VPS，让 Nginx 指向它即可。

真正折腾的不是“静态站怎么托管”，而是把整条自动化链路打通：

1. GitHub Actions 负责安装依赖、构建站点；
2. Actions 通过 SSH 登录 VPS；
3. 用 `rsync` 上传 `dist/`；
4. VPS 上用软链接原子切换版本；
5. 宝塔面板配置站点根目录和 SSL；
6. DNS 把 `blog.amamo.top` 指到 VPS 公网 IP。

本文按实际顺序记录全过程，包括每一步如何验证、遇到了哪些报错、最后怎么解决。

---

## 一、整体部署模型

最终采用的目录结构如下：

```text
/www/wwwroot/firefly/
├── releases/
│   ├── <commit-sha-1>/
│   ├── <commit-sha-2>/
│   └── ...
└── current -> releases/<最新 commit-sha>/
```

GitHub Actions 每次构建完成后：

1. 上传 `dist/` 到 `releases/$GITHUB_SHA/`；
2. 上传完成后才把 `current` 软链切到新版本；
3. 清理旧版本，只保留最近 5 个。

这样做的好处是：**上传过程中用户访问的仍是旧版本，不会出现半个站点。**

> 注意：后来我们把部署目录从 `/var/www/firefly` 改到了 `/www/wwwroot/firefly`，因为宝塔面板禁止把网站根目录直接设到 `/var`、`/home`、`/etc` 等关键目录。

---

## 二、VPS 上创建部署用户

服务器是阿里云轻量应用服务器，系统是 CentOS。最开始我照着 Ubuntu 写法用了：

```bash
adduser --disabled-password --gecos "" deploy
```

结果终端输出了一堆 `adduser/useradd` 帮助信息，用户根本没创建成功。随后 `chown`、`sudo -u deploy` 全部失败。

CentOS 上应该用：

```bash
useradd -m -s /bin/bash deploy
id deploy
```

看到类似输出才算成功：

```text
uid=1001(deploy) gid=1001(deploy) groups=1001(deploy)
```

创建目录并授权：

```bash
mkdir -p /www/wwwroot/firefly
chown -R deploy:deploy /www/wwwroot/firefly
```

验证 deploy 用户确实能写：

```bash
su - deploy -c 'touch /www/wwwroot/firefly/.test && echo 写入成功 && rm /www/wwwroot/firefly/.test'
```

看到 `写入成功` 就说明第一步没问题。

### 当时的报错

```text
id: 'deploy': no such user
sudo: unknown user: deploy
sudo: error initializing audit plugin sudoers audit
```

原因都是用户还没建出来，不是 sudo 本身的问题。用户建好后，用 `su - deploy -c '...'` 验证即可。

---

## 三、生成专用 SSH 密钥

部署用的 SSH 密钥不要复用个人主力密钥，单独生成一对：

```bash
ssh-keygen -t ed25519 -C "github-actions@firefly" -f ~/.ssh/firefly_deploy_key
# 不设置 passphrase
```

生成后会有两个文件：

```text
~/.ssh/firefly_deploy_key      # 私钥，填到 GitHub Secret
~/.ssh/firefly_deploy_key.pub  # 公钥，装到 VPS
```

验证密钥对是否匹配：

```bash
ssh-keygen -y -f ~/.ssh/firefly_deploy_key
```

输出应该和 `.pub` 文件内容一致。

### 公钥装到哪里？

公钥要装到 **VPS 上 deploy 用户** 的 `authorized_keys`：

```bash
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
echo "ssh-ed25519 xxxxx github-actions@firefly" > /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
restorecon -Rv /home/deploy/.ssh 2>/dev/null || true
```

验证：

```bash
ls -ld /home/deploy/.ssh
ls -l /home/deploy/.ssh/authorized_keys
cat /home/deploy/.ssh/authorized_keys
```

权限应类似：

```text
drwx------ ... deploy deploy ... /home/deploy/.ssh
-rw------- ... deploy deploy ... /home/deploy/.ssh/authorized_keys
```

最后从本地测试登录：

```bash
ssh -i ~/.ssh/firefly_deploy_key -p 22 deploy@<VPS_IP> 'whoami && pwd'
```

成功输出：

```text
deploy
/home/deploy
```

这一步通过后，GitHub Actions 才能用同一把私钥登录 VPS。

---

## 四、GitHub Actions 工作流

在项目里新增 `.github/workflows/deploy-vps.yml`：

```yaml
name: Build and Deploy to VPS

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deploy-vps
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    env:
      VPS_HOST: ${{ secrets.VPS_HOST }}
      VPS_USER: ${{ secrets.VPS_USER }}
      VPS_PORT: ${{ secrets.VPS_PORT || '22' }}
      VPS_PATH: ${{ secrets.VPS_PATH }}
      RELEASE: ${{ github.sha }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build site
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm run build

      - name: Setup SSH key
        env:
          SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: |
          eval "$(ssh-agent -s)"
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          printf '%s\n' "$SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-add ~/.ssh/id_ed25519

      - name: Trust VPS host key
        run: |
          ssh-keyscan -p "$VPS_PORT" -H "$VPS_HOST" >> ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Prepare release directory
        run: |
          ssh -p "$VPS_PORT" -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "mkdir -p '$VPS_PATH/releases'"

      - name: Upload dist/
        run: |
          rsync -avz --delete \
            -e "ssh -p $VPS_PORT -o StrictHostKeyChecking=yes" \
            dist/ \
            "$VPS_USER@$VPS_HOST:$VPS_PATH/releases/$RELEASE/"

      - name: Activate release
        run: |
          ssh -p "$VPS_PORT" -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "cd '$VPS_PATH' && ln -nfs 'releases/$RELEASE' current.tmp && mv -Tf current.tmp current"

      - name: Cleanup old releases
        run: |
          ssh -p "$VPS_PORT" -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "cd '$VPS_PATH/releases' && ls -1dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf --"

      - name: Done
        run: echo "Deployed $RELEASE to $VPS_HOST:$VPS_PATH/current"
```

几个设计点：

- `pnpm run build` 是完整构建链：图标/LQIP/随机封面/Astro 构建/Pagefind/IndexNow 等。
- `GITHUB_TOKEN` 用来让 GitHub 卡片脚本访问 GitHub API。
- 上传目标是 `releases/$RELEASE/`，`$RELEASE` 就是 commit SHA。
- `current.tmp` + `mv -Tf` 用来原子替换软链。
- 旧版本只保留最近 5 份，避免磁盘无限增长。

---

## 五、GitHub Secrets 配置

在仓库页面进入：

```text
Settings → Secrets and variables → Actions → New repository secret
```

添加这些 Secret：

| 名称 | 示例值 | 说明 |
| --- | --- | --- |
| `VPS_HOST` | `47.xx.xx.xx` | VPS 公网 IP |
| `VPS_USER` | `deploy` | SSH 用户名 |
| `VPS_PORT` | `22` | SSH 端口，可省略，默认 22 |
| `VPS_PATH` | `/www/wwwroot/firefly` | 部署根目录 |
| `VPS_SSH_KEY` | 私钥全文 | `firefly_deploy_key` 的内容 |

`VPS_SSH_KEY` 要包含完整的首尾行：

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

不要把私钥提交进仓库，也不要贴到公开聊天或日志里。

---

## 六、宝塔面板配置网站

### 1. 添加站点

宝塔面板 → 网站 → 添加站点：

- 域名：`blog.amamo.top`
- 根目录：`/www/wwwroot/firefly/current`
- PHP 版本：选择 **纯静态**

这里踩过坑：一开始想用 `/var/www/firefly/current`，宝塔直接拒绝：

```text
请不要将网站根目录设置到以下关键目录中:
/var
/home
/etc
...
```

所以部署目录改成 `/www/wwwroot/firefly`，站点根目录自然就是 `/www/wwwroot/firefly/current`。

### 2. 配置伪静态

站点设置 → 伪静态，填入：

```nginx
location / {
    try_files $uri $uri/ $uri.html =404;
}

error_page 404 /404.html;
location = /404.html {
    internal;
}
```

Astro 开启了 `trailingSlash: "always"`，生成的是 `目录/index.html` 结构，`try_files $uri $uri/ $uri.html =404;` 正好匹配。

### 3. 配置静态资源缓存

站点设置 → 配置文件，在 `server` 块里加入：

```nginx
location /_astro/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

建议同时开启 Gzip 压缩。

### 4. 申请 SSL

站点设置 → SSL → Let's Encrypt：

- 勾选 `blog.amamo.top`
- 申请证书
- 打开强制 HTTPS

宝塔会自动配置证书续期。

---

## 七、DNS 解析

因为网站走标准 80 / 443 端口，DNS 只需要配置 A 记录，不需要写端口。

到域名服务商的 DNS 解析页面添加/修改：

| 字段 | 值 |
| --- | --- |
| 类型 | `A` |
| 主机记录 | `blog` |
| 记录值 | VPS 公网 IP |
| TTL | 默认即可 |

最终效果：

```text
blog.amamo.top.  A  <VPS_IP>
```

如果之前博客指向 Vercel / Cloudflare，可能存在一条 CNAME：

```text
blog  CNAME  cname.vercel-dns.com
```

需要删除或改成 A 记录，否则域名仍然指向旧平台。

验证 DNS：

```bash
nslookup blog.amamo.top
```

输出的 `Address` 应该是 VPS 公网 IP。

### 为什么不用写端口？

浏览器访问：

```text
http://  默认 80 端口
https:// 默认 443 端口
```

DNS 只负责把域名解析到 IP，不负责端口。只要 Nginx / 宝塔监听 80 和 443，并且 SSL 配好了，就可以直接用 `https://blog.amamo.top` 访问。

---

## 八、第一次部署失败的排查

提交并推送工作流后，Actions 日志显示构建全部成功：

```text
✓ Completed in 56.54s.
69 page(s) built in 1m 2s
Complete!
```

Pagefind、字体子集化、IndexNow 也都跑完了。但最后上传阶段失败：

```text
bash: rsync: command not found
rsync error: error in rsync protocol data stream (code 12)
```

原因是：GitHub Actions runner 自带 `rsync`，但它通过 SSH 调用远端 VPS 上的 `rsync`；VPS 没装，所以失败。

解决：

```bash
yum install -y rsync
which rsync
rsync --version | head -1
```

然后回到 GitHub Actions 页面手动点 **Run workflow**，重新跑一次即可。

---

## 九、阿里云“异常登录”告警

部署期间收到阿里云邮件：

```text
您的服务器存在异常登录行为：ECS在非常用地登录
```

这是 GitHub Actions runner 从海外 IP SSH 登录 VPS 触发的安全告警。因为是我们自己配置的部署流程，且登录用户是专用 `deploy`，可以忽略。

如果担心安全，可以进一步做：

- 修改 SSH 默认端口，并同步设置 `VPS_PORT` Secret；
- 禁止 root 密码登录；
- 只允许密钥登录；
- 用安全组限制 SSH 来源；
- 定期检查 `/home/deploy/.ssh/authorized_keys`。

---

## 十、如何确认部署成功

GitHub Actions 全部绿勾后，在 VPS 上执行：

```bash
ls -la /www/wwwroot/firefly/current
readlink -f /www/wwwroot/firefly/current
```

应该看到 `current` 指向：

```text
/www/wwwroot/firefly/releases/<commit-sha>
```

目录里应该有：

```text
index.html
404.html
_astro/
pagefind/
rss.xml
sitemap-index.xml
```

再测试访问：

```bash
curl -I http://blog.amamo.top
curl -I https://blog.amamo.top
```

看到 `200` 或正常的 HTTPS 跳转，最后浏览器打开 `https://blog.amamo.top`，博客正常显示，就说明整条链路通了。

---

## 十一、踩坑清单速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `adduser` 打印帮助，`id deploy` 不存在 | CentOS 不适用 Ubuntu 写法 | `useradd -m -s /bin/bash deploy` |
| `sudo: unknown user: deploy` | 用户还没创建 | 先创建用户；用 `su - deploy -c` 验证 |
| `cannot remove .../.test: No such file or directory` | `rm` 路径手误 | 清理正确路径：`rm -f /www/wwwroot/firefly/.test` |
| 宝塔拒绝关键目录 | 不能把站点根目录设到 `/var` 等 | 改用 `/www/wwwroot/firefly/current` |
| `bash: rsync: command not found` | VPS 没装 rsync | `yum install -y rsync` |
| 阿里云异常登录告警 | Actions 海外 IP 登录 VPS | 自己配置的部署可忽略，建议加固 SSH |
| 构建提示 robots.txt 冲突 | `public/robots.txt` 覆盖动态路由 | 域名正确则无影响；想优化可删静态版 |
| 域名指向旧平台 | DNS 里还有 CNAME | 改成 A 记录指向 VPS IP |

---

## 结语

完成后，博客的更新流程变成：

```bash
# 本地写文章、改配置
git add .
git commit -m "feat: 新文章"
git push origin main
```

剩下的事情全部交给 GitHub Actions：

```text
push → Actions 构建 → SSH 登录 VPS → rsync 上传 → 切换 current → 宝塔/Nginx 提供访问
```

平台托管适合“不想管服务器”，自建 VPS 适合“想完全掌控”。把 CI/CD 这条链路打通后，自建 VPS 的维护成本其实也可以很低：以后每次写文章，只需要 push，博客就会自动更新。
