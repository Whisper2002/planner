# DResearch Planner Web

Planner 模块的独立静态网页包。它与 Obsidian 插件共用数据结构和同步协议，构建后的 `site/` 可直接发布到 GitHub Pages。

## 使用

1. 如需从 DResearch 工作区更新网页包，在插件目录已安装依赖的情况下执行 `npm run build`。
2. 将 `site/` 发布到 GitHub Pages。
3. 网页端填写 GitHub Token 和 Secret Gist ID；插件端在“系统设置 → 计划同步”填写同一组配置。

Token 只保存在当前浏览器；插件端 Token 使用 Obsidian SecretStorage。同步按任务、日程、重复系列、周期计划、习惯逐项合并，删除记录以墓碑形式保留，避免旧设备恢复已删除内容。
