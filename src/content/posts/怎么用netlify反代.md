---
title: "怎么用Netlify反代你的源站"
published: 2026-08-05
updated: 2026-08-05
draft: false
tags: ['反向代理', 'netlify']
category: '反向代理'
author: 'Admin'
---


## 怎么反代

首先去[Netlify官网](https://app.netlify.com/) 注册账号。再去你的github新建一个仓库，只要写一个netlify.toml（在根目录下），内容如下
```
[[redirects]]
  from = "/*"
  to = "http://反代域名:反代端口/:splat"
  status = 200
  force = true
```
你只要替换http://反代域名:反代端口/:splat
如果你实际要反代的url没有端口就不填，但一定要有端口后的 **/** 
最后回netlify创建一个新项目，选择你刚创建的Github项目，部署即可 最后绑定一下你的域名。