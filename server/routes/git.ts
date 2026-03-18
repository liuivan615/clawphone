import type { FastifyInstance } from "fastify";
import { spawnSync } from "child_process";
import { getCodexConfig } from "../gateway-client.js";

function git(cwd: string, args: string[], allowedStatuses: number[] = [0]): string {
  const result = spawnSync("git", args, {
    cwd,
    timeout: 15000,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowedStatuses.includes(result.status ?? -1)) {
    const msg = result.stderr?.trim() || result.stdout?.trim() || `git exited with code ${result.status}`;
    throw new Error(msg);
  }

  return (result.stdout || "").trim();
}

function parseShortStat(output: string) {
  return {
    files: Number(output.match(/(\d+)\s+files?\s+changed/)?.[1] || 0),
    additions: Number(output.match(/(\d+)\s+insertions?\(\+\)/)?.[1] || 0),
    deletions: Number(output.match(/(\d+)\s+deletions?\(-\)/)?.[1] || 0),
  };
}

export default async function gitRoutes(app: FastifyInstance) {
  // Git status: branch, changed files, stats
  app.get<{ Querystring: { cwd: string } }>("/api/git/status", async (req) => {
    const { cwd } = req.query;
    if (!cwd) return { error: "cwd required" };

    try {
      const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const statusRaw = git(cwd, ["status", "--porcelain", "-u"]);

      const files = statusRaw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const status = line.slice(0, 2).trim();
          const path = line.slice(3);
          return {
            path,
            status, // M, A, D, ??, etc.
            staged: line[0] !== " " && line[0] !== "?",
          };
        });

      // Diff stats
      let stagedStats = { additions: 0, deletions: 0, files: 0 };
      let unstagedStats = { additions: 0, deletions: 0, files: 0 };

      try {
        stagedStats = parseShortStat(git(cwd, ["diff", "--cached", "--shortstat"]));
      } catch { /* no staged changes */ }

      try {
        unstagedStats = parseShortStat(git(cwd, ["diff", "--shortstat"]));
      } catch { /* no unstaged changes */ }

      // Untracked count
      const untrackedCount = files.filter((f) => f.status === "??").length;

      return {
        branch,
        files,
        stagedStats,
        unstagedStats,
        untrackedCount,
        totalFiles: files.length,
        totalAdditions: stagedStats.additions + unstagedStats.additions,
        totalDeletions: stagedStats.deletions + unstagedStats.deletions,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Git diff for a specific file
  app.get<{ Querystring: { cwd: string; path?: string; mode?: string; staged?: string } }>(
    "/api/git/diff",
    async (req) => {
      const { cwd, path, mode, staged } = req.query;
      if (!cwd) return { error: "cwd required" };

      try {
        if (mode === "untracked") {
          if (!path) return { error: "path required for untracked diff" };
          const diff = git(cwd, ["diff", "--no-index", "--", "/dev/null", path], [0, 1]);
          return { diff };
        }

        const diffArgs = ["diff"];

        if (mode === "all") {
          diffArgs.push("HEAD");
        } else if (mode === "staged" || staged === "true") {
          diffArgs.push("--cached");
        }

        if (path) {
          diffArgs.push("--", path);
        }

        const diff = git(cwd, diffArgs);
        return { diff };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  // Git log (recent commits)
  app.get<{ Querystring: { cwd: string; count?: string } }>(
    "/api/git/log",
    async (req) => {
      const { cwd, count = "20" } = req.query;
      if (!cwd) return { error: "cwd required" };

      try {
        const parsedCount = Number.parseInt(count, 10);
        const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.min(parsedCount, 100) : 20;
        const raw = git(cwd, ["log", `--max-count=${safeCount}`, "--format=%H|%h|%s|%an|%ar"]);
        const commits = raw.split("\n").filter(Boolean).map((line) => {
          const [hash, short, message, author, timeAgo] = line.split("|");
          return { hash, short, message, author, timeAgo };
        });
        return { commits };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  // Stage files
  app.post<{ Body: { cwd: string; paths?: string[]; all?: boolean } }>(
    "/api/git/stage",
    async (req) => {
      const { cwd, paths, all } = req.body;
      if (!cwd) return { error: "cwd required" };

      try {
        if (all) {
          git(cwd, ["add", "-A"]);
        } else if (paths && paths.length > 0) {
          git(cwd, ["add", "--", ...paths]);
        }
        return { ok: true };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  // Commit
  app.post<{
    Body: {
      cwd: string;
      message?: string;
      includeUnstaged?: boolean;
    };
  }>("/api/git/commit", async (req) => {
    const { cwd, message, includeUnstaged } = req.body;
    if (!cwd) return { error: "cwd required" };

    try {
      // Stage all if requested
      if (includeUnstaged) {
        git(cwd, ["add", "-A"]);
      }

      // Auto-generate message if empty
      const commitMsg = message?.trim() || git(cwd, ["diff", "--cached", "--shortstat"]);

      git(cwd, ["commit", "-m", commitMsg]);

      const hash = git(cwd, ["rev-parse", "--short", "HEAD"]);
      return { ok: true, hash, message: commitMsg };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Push
  app.post<{ Body: { cwd: string } }>("/api/git/push", async (req) => {
    const { cwd } = req.body;
    if (!cwd) return { error: "cwd required" };

    try {
      const result = git(cwd, ["push"]);
      return { ok: true, output: result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // List branches
  app.get<{ Querystring: { cwd: string } }>("/api/git/branches", async (req) => {
    const { cwd } = req.query;
    if (!cwd) return { error: "cwd required" };

    try {
      const raw = git(cwd, ["branch", "-a", "--format=%(refname:short)|%(HEAD)"]);
      const branches = raw.split("\n").filter(Boolean).map((line) => {
        const [name, head] = line.split("|");
        return { name, current: head === "*" };
      });
      return { branches };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // AI-generate commit message from diff
  app.post<{ Body: { cwd: string } }>("/api/git/ai-commit-msg", async (req) => {
    const { cwd } = req.body;
    if (!cwd) return { error: "cwd required" };

    try {
      // Get the diff (staged or all)
      let diff: string;
      try {
        diff = git(cwd, ["diff", "--cached", "--stat"]);
        if (!diff) diff = git(cwd, ["diff", "--stat"]);
      } catch {
        diff = "";
      }

      let diffDetail: string;
      try {
        diffDetail = git(cwd, ["diff", "--cached"]);
        if (!diffDetail) diffDetail = git(cwd, ["diff"]);
      } catch {
        diffDetail = "";
      }

      if (!diff && !diffDetail) {
        return { message: "no changes to commit" };
      }

      // Call Codex API to generate commit message
      const config = getCodexConfig();
      const res = await fetch(`${config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            {
              role: "user",
              content: `Based on this git diff, write a concise commit message (1-2 lines). Use conventional commit format (feat/fix/refactor/docs/chore). Reply with ONLY the commit message, no explanation.\n\nDiff summary:\n${diff}\n\nDetailed diff (first 3000 chars):\n${diffDetail.slice(0, 3000)}`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: `API error ${res.status}: ${text}` };
      }

      const data = (await res.json()) as { output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = data.output?.[0]?.content?.[0]?.text || "";
      return { message: text.trim() };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Switch branch
  app.post<{ Body: { cwd: string; branch: string } }>("/api/git/checkout", async (req) => {
    const { cwd, branch } = req.body;
    if (!cwd || !branch) return { error: "cwd and branch required" };

    try {
      git(cwd, ["checkout", branch]);
      return { ok: true, branch };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Create branch
  app.post<{ Body: { cwd: string; name: string } }>("/api/git/branch/create", async (req) => {
    const { cwd, name } = req.body;
    if (!cwd || !name) return { error: "cwd and name required" };

    try {
      git(cwd, ["checkout", "-b", name]);
      return { ok: true, branch: name };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Delete branch
  app.post<{ Body: { cwd: string; name: string } }>("/api/git/branch/delete", async (req) => {
    const { cwd, name } = req.body;
    if (!cwd || !name) return { error: "cwd and name required" };

    try {
      git(cwd, ["branch", "-d", name]);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Create PR using GitHub CLI
  app.post<{
    Body: { cwd: string; title?: string; body?: string; draft?: boolean };
  }>("/api/git/pr", async (req) => {
    const { cwd, title, body, draft } = req.body;
    if (!cwd) return { error: "cwd required" };

    try {
      // Check if gh is available
      const ghVersion = spawnSync("gh", ["--version"], { encoding: "utf-8", timeout: 5000 });
      if (ghVersion.status !== 0) {
        return { error: "GitHub CLI (gh) 未安装。运行: winget install GitHub.cli" };
      }

      const args = ["pr", "create"];
      if (title) args.push("--title", title);
      if (body) args.push("--body", body);
      if (draft) args.push("--draft");
      if (!title) args.push("--fill");

      const result = spawnSync("gh", args, {
        cwd,
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || `gh exited with code ${result.status}`);
      }

      const prUrl = (result.stdout || "").trim();
      return { ok: true, url: prUrl };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
