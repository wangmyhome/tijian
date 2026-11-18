# 启用 DeepSeek AI 解析

网页上的「AI解析」按钮已经接好。只有点击按钮才会请求解析；普通答题、自动下一题、打开解析区和页面刷新都不会自动调用 DeepSeek。生成结果保存在当前账号的学习记录中，同账号可同步；点击「查看 AI 解析」读取已有结果，点击「重新生成」才再次请求。

这一步需要项目管理权限。当前电脑没有 Supabase CLI 登录，按下面的后台步骤配置即可，不需要修改数据库。

1. 打开本项目的 Supabase 后台，在 **Edge Functions → Secrets** 添加一项：名称为 `DEEPSEEK_API_KEY`，值填写你自己的 DeepSeek key。保存。密钥只放在此处。
2. 在 **Edge Functions** 创建函数，选择通过编辑器部署，函数名称填写 **`ai-explain`**。将 [函数代码](functions/ai-explain/index.ts) 的完整内容复制到编辑器的 `index.ts`，点击 Deploy / 部署。
3. 打开 `ai-explain` 的配置，关闭 **Verify JWT with legacy secret / JWT verification**，保存。函数内部会通过 Supabase Auth 校验登录身份，并从共享题库读取原题；这一项关闭后仍要求用户登录。
4. 打开题间网站，登录、完成一道题，再点击结果下方的 **AI解析**。如页面仍是旧版，刷新后重试。

默认使用 `deepseek-chat`，电脑与手机的所有已登录账号都可使用。模拟考试交卷后的回顾页面也提供按钮，考试进行中不展示解析入口。每次最多生成约 1,500 tokens，失败后由用户点击重试。此功能会使用 DeepSeek 账户余额。

如使用自定义网站域名，可另加 Secret `AI_ALLOWED_ORIGINS`，值为允许的网站来源，多个用英文逗号分隔，例如 `https://example.com,https://wangmyhome.github.io`。只填协议和域名，不填 `/tijian/` 等路径。默认已允许当前 GitHub Pages 网站及本机 8766 端口。

已有 Supabase CLI 登录的电脑也可使用 `supabase functions deploy ai-explain --project-ref plgqouambkntvxjzajww` 部署，项目配置已包含 JWT 设置。DeepSeek key 仍通过 Supabase Secrets 设置。

常见提示：

- 「AI解析服务尚未部署」：检查函数名是否为 `ai-explain`，是否已部署成功。
- 「AI解析尚未配置」：检查 Secrets 中的 `DEEPSEEK_API_KEY`。
- 「AI服务密钥无效／余额不足」：在 DeepSeek 控制台检查密钥或余额。
- 「题目尚未同步到云端」：管理员先完成题库同步，再使用解析。
- 「题目已更新」：同步题库后重新作答，确保解析对应当前题目。

函数源码不包含密钥；生成的解析是当前账号的学习数据，不会改写共享题库的标准答案或原解析。服务端每个实例对同一账号做每分钟 10 次的基础限速；跨实例的严格总额度需要后续增加数据库限额。
