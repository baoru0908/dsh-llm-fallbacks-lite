# dsh-llm-fallbacks-lite

> DeepSeek Harness 模型降级链插件的**自用魔改版（Lite）**。
>
> ⚠️ **本仓库内容由 AI 自动生成**，用于个人自用；未经原插件作者审阅。完整上游源码请见
> [omdsh-dev/dsh-llm-fallbacks](https://github.com/omdsh-dev/dsh-llm-fallbacks)。

## 魔改来源

- **上游原版**：`omdsh-dev/dsh-llm-fallbacks`（`v0.6.5`，commit `2980e52 chore(release): prepare v0.6.5`）
- 本仓库在 v0.6.5 源码基础上做自用改造，适配 **DSH NEXT（DeepSeek Harness 桌面客户端，`@linxin666` 插件体系）** 与个人使用需求。
- 完整源码以原版为准；本仓库保留并说明**所有改动点**（见下）。

## 魔改了啥

| # | 模块 | 改动 | 效果 |
|---|---|---|---|
| 1 | host · `src/index.ts` | 降级链触发门从「`triggerCodes` 白名单才降级」改为「**默认降级 + 排除集**」（仅 `CONTEXT_WINDOW_EXCEEDED` 不降级、留给 compaction） | workbuddy 桥接模型失败抛普通 `Error`（无结构化 code），原版永不触发降级、第一个模型一断会话就断；自用版任何模型失败都自动进入降级链，**会话不断、逐级续到下一个候选、不跳供应商** |
| 2 | client · `src/client/FallbacksCard.tsx` | provider 下拉从「只列配置过的 provider（`configuredProviders`，按 settings namespace 过滤）」放宽为「**列出全部 catalog 可见 provider**（`listConfigurableProviders`）」 | workbuddy-xdpool 等账号池插件不再被过滤，**所有在 dsh 模型候选里可见的提供商都直接在下拉里可选**，不只手输 |
| 3 | client · `src/client/FallbacksCard.tsx` + `locales.ts` | 链条目选择器 provider/model 下拉各加「✎ 手动输入…」 | 可输入任意不在目录的字符串（如 `workbuddy-xdpool` / `hy3`）按原样保存，通用兜底 |
| 4 | client · `src/client/index.ts` | 把可编辑配置卡片挂到 DSH NEXT 设置界面的「Web 插件」section（`web-ui.plugin.item` seat） | 替代已被 alpha.2 移除的 `settings.plugin.item`；**设置界面可直接进入 Fallbacks 配置**（原版只有插件页入口） |
| 5 | client · `src/client/locales.ts` | 卡片标题加「· 自用版 Lite」 | 与官方 0.6.5 便于区分（DSH 接管 node_modules 的 `package.json` version，直接改版本号会被还原，故用 UI 标识） |

## 构建与部署

```bash
# 依赖安装（系统 pnpm 6 在 Node 22 下会报 ERR_INVALID_THIS，务必用 pnpm@10）
npx --yes pnpm@10 install --registry=https://registry.npmjs.org

# 构建（tsc + tsdown + build-client + verify-dist）
npx --yes pnpm@10 build
```

产物：`dist/index.js`（host）+ `dist/client/index.js`（client）。

**部署到 DSH NEXT desktop**：把构建产物复制到 desktop profile 的
`~/.dsh/profiles/desktop/node_modules/dsh-llm-fallbacks/dist/`，重启 DSH NEXT 生效。
（desktop profile 由 Electron 独占管理，不能走 `dsh plugin --profile desktop` CLI。）

## 说明

- `package.json` `version` 为 `0.6.5-lite.1`（本地源码）；DSH 桌面应用会接管并还原 desktop 侧
  `node_modules` 的版本号，故自用版以「自用版 Lite」UI 标识区分，而非依赖版本号。
- 原版「auto = 默认降级链」的语义不变；本次修复的是「降级链第一个模型断了会话直接断、不自动继续」的缺陷。
- **AI 生成声明**：本仓库（README 与改动）由 AI 自动生成，仅供个人自用参考。
