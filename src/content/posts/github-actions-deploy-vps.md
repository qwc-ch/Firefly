---
title: "从平台托管到自建 VPS：用 GitHub Actions 构建并部署 Firefly"
published: 2026-11-27
description: "记录把 Firefly 静态博客从 Vercel / EdgeOne 等平台迁到自建 VPS 的完整过程：GitHub Actions 构建、SSH 密钥、rsync 上传、宝塔面板配置、DNS 解析，以及一路踩过的坑。"
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
3. 用 `rsync` 把 `dist/` 直接同步到宝塔站点根目录；
4. 宝塔面板配置站点根目录和 SSL；
5. DNS 把 `blog.amamo.top` 指到 VPS 公网 IP。

本文按实际顺序记录全过程，包括每一步如何验证、遇到了哪些报错、最后怎么解决。

---

## 一、整体部署模型

最终采用的方案很简单：**`dist/` 直接同步到宝塔站点根目录**。

```text
/www/wwwroot/firefly/          ← 宝塔站点根目录，也是 rsync 的目标
├── index.html
├── 404.html
├── _astro/                    ← 哈希化的静态资源
├── pagefind/                  ← 搜索索引
├── posts/
├── rss.xml
└── sitemap-index.xml
...
```

GitHub Actions 每次构建完成后：

1. 先清理第一次试验遗留的 `releases/` + `current` 软链；
2. 用 `rsync --delete` 把 `dist/` 同步到 `/www/wwwroot/firefly/`；
3. `--delete` 会删掉上一次构建残留的文件，保证目录内容和 `dist/` 完全一致。

> 一开始我设计过 `releases/<sha>/` + `current` 软链的"原子切换"方案，但宝塔面板不允许把站点根目录改到自定义软链路径，最后改成直接同步到固定根目录。代价是上传过程中理论上可能读到半个站点，但对个人博客几乎无感，且配置简单得多。

> 部署目录从 `/var/www/firefly` 改到了 `/www/wwwroot/firefly`，因为宝塔面板禁止把网站根目录直接设到 `/var`、`/home`、`/etc` 等关键目录。

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

# 同一时间只允许一个部署任务，避免两次发布交叉覆盖
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

      # 清掉第一次部署遗留的 releases/ + current 软链结构
      - name: Clean legacy release dirs
        run: |
          ssh -p "$VPS_PORT" -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "rm -rf '$VPS_PATH/releases' '$VPS_PATH/current.tmp' 2>/dev/null || true; rm -f '$VPS_PATH/current' 2>/dev/null || true"

      # 直接把 dist/ 同步到站点根目录（宝塔的 root 就指向这里）
      - name: Upload dist/ to site root
        run: |
          rsync -avz --delete \
            --exclude='releases/' \
            --exclude='current' \
            --exclude='current.tmp' \
            --exclude='.user.ini' \
            --exclude='.htaccess' \
            --exclude='.well-known/' \
            -e "ssh -p $VPS_PORT -o StrictHostKeyChecking=yes" \
            dist/ \
            "$VPS_USER@$VPS_HOST:$VPS_PATH/"

      - name: Done
        run: echo "Deployed to $VPS_HOST:$VPS_PATH"
```

几个设计点：

- `pnpm run build` 是完整构建链：图标/LQIP/随机封面/Astro 构建/Pagefind/IndexNow 等。
- `GITHUB_TOKEN` 用来让 GitHub 卡片脚本访问 GitHub API。
- 上传目标是 `$VPS_PATH/`（即宝塔站点根目录），rsync 目标末尾的 `/` 不能省略。
- `--delete` 清掉上一次构建的残留文件，保证目录与 `dist/` 完全一致。
- `Clean legacy release dirs` 清掉最初试验留下的 `releases/` 和 `current`，避免它们干扰 rsync。
- `--exclude` 排除宝塔托管文件（`.user.ini`、`.htaccess`、`.well-known/`），否则 `--delete` 删除被 `chattr +i` 锁死的 `.user.ini` 时会报 code 23（详见后文踩坑）。

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
- 根目录：`/www/wwwroot/firefly`（和 `VPS_PATH` Secret 保持一致）
- PHP 版本：选择 **纯静态**

这里踩过两个坑：

1. 一开始想用 `/var/www/firefly`，宝塔直接拒绝：

```text
请不要将网站根目录设置到以下关键目录中:
/var
/home
/etc
...
```

所以部署目录改到了 `/www/wwwroot/firefly`。

2. 后来我设计过 `releases/<sha>/` + `current` 软链，想把站点根目录设成 `/www/wwwroot/firefly/current`，但宝塔面板的"站点根目录"输入框不接受这种软链路径（改不了/不生效）。最后干脆放弃软链，让 rsync 直接同步到固定根目录 `/www/wwwroot/firefly`。

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
# 用 ^~ 优先匹配 _astro/ 前缀，避免被宝塔默认的 js/css 正则规则抢先
location ^~ /_astro/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

`_astro/` 里的资源都带内容哈希，改内容必然换文件名，所以可以放心设 1 年强缓存。建议同时开启 Gzip 压缩。

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

## 八、部署过程中的几个失败

整个调试过程 Actions 失败过好几次，原因各不相同，逐一记录。

### 失败 1：VPS 没装 rsync

构建全部成功：

```text
✓ Completed in 56.54s.
69 page(s) built in 1m 2s
Complete!
```

但上传阶段失败：

```text
bash: rsync: command not found
rsync error: error in rsync protocol data stream (code 12)
```

原因：GitHub Actions runner 自带 `rsync`，但它通过 SSH 调用远端 VPS 上的 `rsync`；VPS 没装，所以失败。

解决：

```bash
yum install -y rsync
which rsync
rsync --version | head -1
```

### 失败 2：删除遗留 releases 目录

改成直接同步后，第一次跑还在删除最初的 `releases/<sha>/` 遗留目录时失败。解决是在上传前主动清理，并在 rsync 里排除：

```yaml
- name: Clean legacy release dirs
  run: |
    ssh ... "rm -rf '$VPS_PATH/releases' ... || true; rm -f '$VPS_PATH/current' || true"

# rsync 里：
--exclude='releases/' \
--exclude='current' \
--exclude='current.tmp' \
```

### 失败 3：宝塔的 .user.ini 删不掉（code 23）

这是最隐蔽的一个。日志里全是正常上传，但最后报：

```text
rsync: delete_file: unlink(.user.ini) failed: Operation not permitted (1)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)
```

原因：宝塔会在站点根目录放一个 `.user.ini`，并用 `chattr +i` 锁成不可删除。rsync 的 `--delete` 想删掉它时被系统拒绝，退出码 23。文件其实都传上去了（所以线上正常），但 Actions 判定 failed。

解决：在 rsync 里排除宝塔托管文件：

```yaml
--exclude='.user.ini' \
--exclude='.htaccess' \
--exclude='.well-known/' \
```

这些文件本来就不该由 rsync 管理。排除后 `--delete` 不会碰它们，就不会报 code 23 了。

### 附：本地 push 分叉

调试中我用 `git commit --amend` 改写了一个已经 push 过的提交，导致本地和远程分叉，`git push` 被拒（`non-fast-forward`）。修复方式是不改写历史，用 `git reset --soft origin/main` 保留最终文件状态后重新做一个新提交，让本地直接叠在远程 tip 之上，即可 fast-forward push。

教训：**已经 push 过的提交不要用 `commit --amend`。**

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

GitHub Actions 全部绿勾后，在 VPS 上直接检查站点根目录：

```bash
ls -la /www/wwwroot/firefly | head -20
```

应该能看到：

```text
index.html
404.html
_astro/
pagefind/
posts/
rss.xml
sitemap-index.xml
```

然后测试访问：

```bash
curl -I http://blog.amamo.top
curl -I https://blog.amamo.top
```

看到 `200` 或正常的 HTTPS 跳转还不够——**一定要抓源码确认不是宝塔默认页**：

```bash
curl -s https://blog.amamo.top | grep -o '<title>[^<]*</title>'
```

这里踩过一个坑：`curl -I` 返回 200，但打开是宝塔的"恭喜，站点创建成功！"默认页。原因是当时 `dist/` 还没上传（push 失败导致 Actions 没跑）。**判断标准不是状态码，而是页面标题必须是博客的标题。**

最后浏览器打开 `https://blog.amamo.top`，博客正常显示，就说明整条链路通了。

---

## 十一、踩坑清单速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `adduser` 打印帮助，`id deploy` 不存在 | CentOS 不适用 Ubuntu 写法 | `useradd -m -s /bin/bash deploy` |
| `sudo: unknown user: deploy` | 用户还没创建 | 先创建用户；用 `su - deploy -c` 验证 |
| `cannot remove .../.test: No such file or directory` | `rm` 路径手误 | 清理正确路径：`rm -f /www/wwwroot/firefly/.test` |
| 宝塔拒绝关键目录 | 不能把站点根目录设到 `/var` 等 | 改用 `/www/wwwroot/firefly` |
| 宝塔站点根目录不接受软链 | 面板输入框改不了 `current` 软链 | 放弃软链，直接同步到固定根目录 |
| `bash: rsync: command not found` | VPS 没装 rsync | `yum install -y rsync` |
| rsync 删除 `releases/` 报错 | 最初软链方案的遗留目录 | 上传前清理 + `--exclude` |
| `unlink(.user.ini) failed` / rsync code 23 | 宝塔 `chattr +i` 锁死 `.user.ini` | `--exclude='.user.ini'` 等宝塔文件 |
| `curl -I` 200 但显示宝塔默认页 | push 失败，Actions 没跑，`dist/` 没上传 | 抓源码看 `<title>`，确认是博客标题 |
| `non-fast-forward` push 被拒 | amend 了已 push 的提交导致分叉 | `git reset --soft origin/main` 后新建提交 |
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
push → Actions 构建 → SSH 登录 VPS → rsync 同步 dist/ 到站点根目录 → 宝塔/Nginx 提供访问
```

平台托管适合“不想管服务器”，自建 VPS 适合“想完全掌控”。把 CI/CD 这条链路打通后，自建 VPS 的维护成本其实也可以很低：以后每次写文章，只需要 push，博客就会自动更新。
