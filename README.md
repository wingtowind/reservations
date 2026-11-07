# KPL 快闪预约模拟练习

一个可以直接在浏览器里运行的静态练习页面。它模拟开放预约、选择时段、完成验证码和查看分段成绩；不连接真实预约系统，也不会提交真实预约。

## 本地预览

直接用浏览器打开 `index.html` 即可。项目没有安装依赖或构建步骤。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个**公开**仓库，例如 `reservations`。创建时不要勾选自动生成 README、`.gitignore` 或许可证。
2. 在本项目文件夹打开 PowerShell，执行以下命令。把 `你的用户名` 换成自己的 GitHub 用户名，把仓库名改成你实际创建的名称：

   ```powershell
   git init -b main
   git add .
   git commit -m "Publish practice prototype"
   git remote add origin https://github.com/你的用户名/reservations.git
   git push -u origin main
   ```

3. 打开仓库的 **Settings → Pages**。在 **Build and deployment** 中选择 **Deploy from a branch**，分支选 `main`，目录选 `/(root)`，然后保存。
4. 等待 GitHub Pages 发布完成，在同一页面点 **Visit site**。地址通常是 `https://你的用户名.github.io/reservations/`，把它发给试用者即可。

以后修改页面后，执行 `git add .`、`git commit -m "描述本次修改"`、`git push` 即可更新网站。

> GitHub Pages 网站对互联网公开。仓库即使设为私有，Pages 网站也可能公开；公开仓库中的文件和历史记录同样可被其他人查看。发布前请确认素材有分享权限。
