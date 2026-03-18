# ClawPhone

> A web-based control panel for [Codex](https://github.com/openai/codex), enabling remote AI-assisted development from any device.

> 基于 Web 的 [Codex](https://github.com/openai/codex) 控制面板，从任何设备远程使用 AI 辅助开发。

---

[English](#english) | [中文](#中文)

---

## English

### What is ClawPhone?

ClawPhone turns OpenAI's Codex CLI into a web interface you can access from your phone, tablet, or any browser. It spawns and manages Codex processes on your machine, streams responses in real-time via WebSocket, and gives you full approval control over every command and file change the AI wants to make.

### Features

- **Real-time Streaming** — Agent text, reasoning, and command output stream live via WebSocket
- **Human-in-the-Loop** — Approve or deny every command execution and file modification before it happens
- **Multi-Session** — Run multiple independent Codex agents simultaneously on different workspaces
- **Persistent History** — Save, resume, fork, and compact conversation threads
- **Multi-Model** — Switch between models and reasoning effort levels on the fly
- **Code Review** — Built-in review system with findings and confidence scoring
- **Git Integration** — Branch status, diffs, and commit info right in the UI
- **File Browser** — Navigate workspace files and attach them to prompts
- **Image Upload** — Send screenshots or images as context for the AI
- **Remote Access** — Works with Cloudflare Tunnel and Tailscale for secure access anywhere
- **Themes** — Dark, Light, One Dark, Dracula, GitHub Dark
- **Mobile-First** — Designed for touch with safe area insets and responsive layout

### Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, Zustand |
| Backend | Fastify 5, Node.js, TypeScript |
| AI | OpenAI Codex via JSON-RPC 2.0 |
| Real-time | WebSocket (ws) |

### Prerequisites

- **Node.js** 18+
- **Codex CLI** installed and in PATH (`npm install -g @openai/codex`)
- **OpenAI API key** configured in `~/.codex/auth.json` or `OPENAI_API_KEY` env var

### Quick Start

```bash
# Clone
git clone https://github.com/liuivan615/clawphone.git
cd clawphone

# Install
npm install

# Configure
cp .env.example .env
# Edit .env — set CLAWPHONE_TOKEN at minimum

# Run
npm run dev
```

Open `http://localhost:5173` in your browser. Enter your token to log in.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAWPHONE_TOKEN` | Yes | Access token for authentication |
| `OPENAI_API_KEY` | No | OpenAI key (or use `~/.codex/auth.json`) |
| `CODEX_BASE_URL` | No | Override API endpoint |
| `PORT` | No | Server port (default: 3000) |
| `HOST` | No | Bind address (default: 0.0.0.0) |
| `LMSTUDIO_BASE_URL` | No | Local LM Studio endpoint |
| `BRIDGE_URL` | No | Windows app bridge URL |

### Project Structure

```
clawphone/
├── server/                 # Fastify backend
│   ├── index.ts           # Server entry
│   ├── auth.ts            # Token authentication
│   ├── app-server-manager.ts  # Codex process lifecycle
│   ├── gateway-client.ts  # API & service health checks
│   ├── routes/            # REST endpoints
│   └── ws/                # WebSocket handler
├── web/                    # React frontend
│   └── src/
│       ├── App.tsx        # Root component & state
│       ├── components/    # UI components
│       ├── pages/         # Views (Tasks, Files, Changes, Status)
│       ├── hooks/         # useWebSocket
│       └── lib/           # Utilities & types
├── shared/                 # Shared types between server & web
├── .env.example           # Config template
└── package.json
```

### How It Works

1. **You** open ClawPhone in a browser and send a message
2. **ClawPhone server** spawns a `codex app-server` child process
3. **Codex** processes your request, proposes commands or file edits
4. **ClawPhone** streams the response and shows approval prompts
5. **You** approve or deny — Codex proceeds accordingly
6. Full conversation is saved and can be resumed later

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev servers (backend + Vite) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run typecheck` | Type checking |

### License

[MIT](LICENSE)

---

## 中文

### ClawPhone 是什么？

ClawPhone 将 OpenAI 的 Codex CLI 工具转化为 Web 界面，你可以从手机、平板或任何浏览器访问。它在你的机器上启动并管理 Codex 进程，通过 WebSocket 实时推送响应，并让你在 AI 执行任何命令或修改文件之前拥有完全的审批控制权。

### 功能特性

- **实时流式输出** — Agent 文本、推理过程和命令输出通过 WebSocket 实时推送
- **人工审批** — 每个命令执行和文件修改都需要你批准后才会执行
- **多会话** — 在不同工作区同时运行多个独立的 Codex Agent
- **持久化历史** — 保存、恢复、分叉和压缩对话线程
- **多模型** — 随时切换模型和推理深度
- **代码审查** — 内置代码审查系统，展示发现和置信度评分
- **Git 集成** — 在界面中直接查看分支状态、diff 和提交信息
- **文件浏览** — 浏览工作区文件并附加到提示中
- **图片上传** — 发送截图或图片作为 AI 上下文
- **远程访问** — 支持 Cloudflare Tunnel 和 Tailscale 安全远程访问
- **主题切换** — Dark、Light、One Dark、Dracula、GitHub Dark
- **移动端优先** — 为触屏设计，支持安全区域适配和响应式布局

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite 6、Tailwind CSS 4、Zustand |
| 后端 | Fastify 5、Node.js、TypeScript |
| AI | OpenAI Codex（通过 JSON-RPC 2.0） |
| 实时通信 | WebSocket (ws) |

### 环境要求

- **Node.js** 18+
- **Codex CLI** 已安装并在 PATH 中（`npm install -g @openai/codex`）
- **OpenAI API 密钥** 配置在 `~/.codex/auth.json` 或 `OPENAI_API_KEY` 环境变量

### 快速开始

```bash
# 克隆
git clone https://github.com/liuivan615/clawphone.git
cd clawphone

# 安装依赖
npm install

# 配置
cp .env.example .env
# 编辑 .env — 至少设置 CLAWPHONE_TOKEN

# 运行
npm run dev
```

在浏览器中打开 `http://localhost:5173`，输入 token 登录。

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `CLAWPHONE_TOKEN` | 是 | 访问认证 Token |
| `OPENAI_API_KEY` | 否 | OpenAI 密钥（或使用 `~/.codex/auth.json`） |
| `CODEX_BASE_URL` | 否 | 自定义 API 地址 |
| `PORT` | 否 | 服务器端口（默认 3000） |
| `HOST` | 否 | 绑定地址（默认 0.0.0.0） |
| `LMSTUDIO_BASE_URL` | 否 | 本地 LM Studio 地址 |
| `BRIDGE_URL` | 否 | Windows 应用桥接地址 |

### 工作原理

1. **你** 在浏览器中打开 ClawPhone，发送消息
2. **ClawPhone 服务端** 启动一个 `codex app-server` 子进程
3. **Codex** 处理请求，提出命令执行或文件编辑建议
4. **ClawPhone** 实时推送响应并显示审批提示
5. **你** 批准或拒绝 — Codex 相应执行
6. 完整对话自动保存，随时可以恢复

### 许可证

[MIT](LICENSE)

---

**Built by Claude (Anthropic) & Codex (OpenAI)**
