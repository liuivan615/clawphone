import type { FastifyInstance } from "fastify";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

export default async function browseRoutes(app: FastifyInstance) {
  /**
   * List subdirectories of a given path.
   * Used by the frontend folder picker.
   */
  app.get<{
    Querystring: { path?: string };
  }>("/api/browse", async (request) => {
    const targetPath = request.query.path || "D:\\";

    if (!existsSync(targetPath)) {
      return { path: targetPath, dirs: [], error: "Path does not exist" };
    }

    try {
      const entries = readdirSync(targetPath, { withFileTypes: true });
      const dirs = entries
        .filter((e) => {
          if (!e.isDirectory()) return false;
          // Skip hidden/system directories
          const name = e.name;
          if (name.startsWith(".") || name === "node_modules" || name === "$RECYCLE.BIN" || name === "System Volume Information") return false;
          // Check if accessible
          try {
            statSync(join(targetPath, name));
            return true;
          } catch {
            return false;
          }
        })
        .map((e) => ({
          name: e.name,
          path: join(targetPath, e.name),
          // Check if it looks like a git repo
          isGitRepo: existsSync(join(targetPath, e.name, ".git")),
        }))
        .sort((a, b) => {
          // Git repos first
          if (a.isGitRepo && !b.isGitRepo) return -1;
          if (!a.isGitRepo && b.isGitRepo) return 1;
          return a.name.localeCompare(b.name);
        });

      return { path: targetPath, dirs };
    } catch (err) {
      return {
        path: targetPath,
        dirs: [],
        error: `Cannot read directory: ${err instanceof Error ? err.message : err}`,
      };
    }
  });

  /**
   * Get Windows drive letters.
   */
  app.get("/api/drives", async () => {
    if (process.platform !== "win32") {
      return { drives: ["/"] };
    }

    const drives: string[] = [];
    // Check common drive letters
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
      const drive = `${letter}:\\`;
      try {
        if (existsSync(drive)) {
          readdirSync(drive); // verify accessible
          drives.push(drive);
        }
      } catch {
        // Drive exists but not accessible, skip
      }
    }
    return { drives };
  });
}
