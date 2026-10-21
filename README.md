# 简历填写助手

面向 Microsoft Edge / Google Chrome 的简历表单填写扩展，基于 [Nanobrowser](https://github.com/nanobrowser/nanobrowser) 修改。绑定本地 JSON 档案，通过自行配置的模型匹配页面字段，填写后由用户核对并手动提交。

## 功能

- 选择并绑定自己的 JSON 档案，在侧栏表格中查看和编辑，保存时写回绑定文件。
- 读取当前招聘页面的表单字段，使用 Navigator 模型匹配资料并尝试填写。
- 核对并补充页面后，点击“已检查，记住本页补充”，将有效信息写回档案。
- 写文件前检查外部修改，避免直接覆盖尚未同步的档案内容。
- 不自动提交；部分复杂下拉框、只读日期和联动控件需要手动处理。

## 本地构建

需要 Node.js >= 22.12.0、pnpm 9.15.1。项目的 packageManager 字段已固定 pnpm 版本；如果本机版本不同，可用 `npx --yes pnpm@9.15.1` 代替下方命令中的 `pnpm`。

```powershell
pnpm install --frozen-lockfile
pnpm build
```

生产扩展生成在 `dist/`。此目录是构建产物，不提交到 Git。默认无需配置 `.env`，也不包含任何模型密钥。

## 安装与使用

1. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
2. 开启开发人员模式，选择“加载解压缩的扩展”，加载本项目的 `dist/`。
3. 打开扩展侧栏的“模型设置”，配置模型提供商、自己的 API Key 和 Navigator 模型。简历填写流程不依赖 Planner。
4. 将 [examples/profile.example.json](examples/profile.example.json) 复制到项目外的个人目录，按自己的情况填写；示例中的学校、公司等都是虚构数据。
5. 点击“选择并绑定 JSON”，授权读写自己的档案文件。
6. 打开招聘表单，点击“填写当前页面”，检查结果并手动补齐。
7. 需要保存补充信息时，点击“已检查，记住本页补充”。最后自行提交表单。

扩展重载或浏览器重启后可能需要重新授权文件访问。更换加载目录可能更换扩展 ID，需要重新配置密钥、绑定档案。

## 开发与验证

```powershell
pnpm type-check
pnpm -F chrome-extension test
pnpm exec turbo lint
```

`pnpm build` 会构建整个工作区。`pnpm exec turbo lint` 使用各子项目现有的 lint 脚本，不使用根目录附带自动修复参数的 lint 命令。

## 目录

```text
chrome-extension/  Manifest、后台服务、表单读取与简历匹配
pages/side-panel/  简历侧栏、档案表格和文件读写
pages/options/     模型和扩展设置
pages/content/     页面内容脚本
packages/          存储、国际化、UI 和构建工具
examples/          仅含虚构数据的档案示例
docs/              上游来源与原始文档
```

## 数据处理与限制

个人档案保存在用户绑定的本地 JSON 文件中，并未加密。运行 AI 填写或记住补充时，档案内容及页面字段会发送给用户配置的模型服务；记住补充还会发送页面 URL。模型服务可能收费。详见 [PRIVACY.md](PRIVACY.md)。

当前保留上游浏览器自动化基础和权限，包括 `<all_urls>`、`debugger` 等；这份整理没有重新收缩权限。浏览器受保护页面不能正常使用，复杂表单的准确性需人工核对。

## 许可证与来源

基于 Nanobrowser，使用 [Apache-2.0](LICENSE)。本地功能与整理范围见 [docs/UPSTREAM.md](docs/UPSTREAM.md)。旧版个人简历扩展、运行交付包及真实个人档案不包含在此源码项目中。

## 验证记录

本次整理的测试结果、已知检查问题和验证范围见 [docs/VALIDATION.md](docs/VALIDATION.md)。GitHub 工作流会在推送后执行构建检查，不自动发布。
