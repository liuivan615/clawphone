import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CodexHistoryService } from "./codex-history.js";

function writeJsonl(path: string, records: unknown[]) {
  writeFileSync(path, records.map((record) => JSON.stringify(record)).join("\n"), "utf-8");
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "clawphone-history-"));
  mkdirSync(join(root, "sessions", "2026", "03", "18"), { recursive: true });

  const resumableId = "019c1111-1111-7111-8111-111111111111";
  const snapshotOnlyId = "019c2222-2222-7222-8222-222222222222";
  const metadataOnlyId = "019c3333-3333-7333-8333-333333333333";

  writeJsonl(join(root, "session_index.jsonl"), [
    {
      id: resumableId,
      thread_name: "修复移动端同步",
      updated_at: "2026-03-18T03:02:56.865Z",
    },
    {
      id: snapshotOnlyId,
      thread_name: "排查只读快照",
      updated_at: "2026-03-18T03:05:00.000Z",
    },
    {
      id: metadataOnlyId,
      thread_name: "只有元数据",
      updated_at: "2026-03-18T03:06:00.000Z",
    },
  ]);

  writeJsonl(join(root, "history.jsonl"), [
    {
      session_id: snapshotOnlyId,
      ts: 1_774_144_500,
      text: "这个线程只剩下 history.jsonl 的用户输入。",
    },
  ]);

  writeJsonl(
    join(root, "sessions", "2026", "03", "18", `rollout-2026-03-18T11-02-56-${resumableId}.jsonl`),
    [
      {
        timestamp: "2026-03-18T03:02:56.865Z",
        type: "session_meta",
        payload: {
          id: resumableId,
          timestamp: "2026-03-18T03:02:56.865Z",
          cwd: "D:\\clawphone",
          originator: "Codex Desktop",
          cli_version: "0.115.0-alpha.27",
          source: "vscode",
          model_provider: "codex-for-me",
        },
      },
      {
        timestamp: "2026-03-18T03:03:01.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "为什么手机端没有电脑历史？",
        },
      },
      {
        timestamp: "2026-03-18T03:03:02.000Z",
        type: "response_item",
        payload: {
          type: "function_call",
          name: "shell_command",
          arguments: JSON.stringify({
            command: "Get-Content C:\\Users\\IVAN\\.codex\\session_index.jsonl -Tail 5",
            workdir: "D:\\clawphone",
          }),
          call_id: "call_1",
        },
      },
      {
        timestamp: "2026-03-18T03:03:03.000Z",
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call_1",
          output: "Exit code: 0\n...output...",
        },
      },
      {
        timestamp: "2026-03-18T03:03:04.000Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          message: "我先把本机 .codex 历史和手机端会话流对齐。",
          phase: "commentary",
        },
      },
    ]
  );

  return { root, resumableId, snapshotOnlyId, metadataOnlyId };
}

test("classifies resumable, snapshot-only, and metadata-only threads", () => {
  const fixture = createFixture();
  const service = new CodexHistoryService(fixture.root);

  const threads = service.listThreads({ limit: 10 });
  assert.equal(threads.length, 3);

  const resumable = threads.find((thread) => thread.id === fixture.resumableId);
  assert.ok(resumable);
  assert.equal(resumable.state, "resumable");
  assert.equal(resumable.workspace, "D:\\clawphone");
  assert.equal(resumable.hasSnapshot, true);

  const snapshotOnly = threads.find((thread) => thread.id === fixture.snapshotOnlyId);
  assert.ok(snapshotOnly);
  assert.equal(snapshotOnly.state, "snapshot_only");
  assert.equal(snapshotOnly.hasSnapshot, true);

  const metadataOnly = threads.find((thread) => thread.id === fixture.metadataOnlyId);
  assert.ok(metadataOnly);
  assert.equal(metadataOnly.state, "metadata_only");
  assert.equal(metadataOnly.hasSnapshot, false);

  const workspaces = service.listWorkspaces();
  assert.equal(workspaces.length, 1);
  assert.equal(workspaces[0].workspace, "D:\\clawphone");
  assert.equal(workspaces[0].threadCount, 1);
});

test("downgrades resumable threads after a resume failure", () => {
  const fixture = createFixture();
  const service = new CodexHistoryService(fixture.root);

  const degraded = service.markResumeFailure(
    fixture.resumableId,
    "Failed to resume thread: no rollout found for thread id"
  );

  assert.ok(degraded);
  assert.equal(degraded.state, "snapshot_only");
  assert.match(degraded.resumeReason || "", /no rollout found/);
});

test("builds continuation prompts from local history context", () => {
  const fixture = createFixture();
  const service = new CodexHistoryService(fixture.root);

  const payload = service.createContinuePayload(fixture.resumableId);

  assert.ok(payload);
  assert.equal(payload.workspace, "D:\\clawphone");
  assert.match(payload.prompt, /手机端没有电脑历史/);
  assert.match(payload.prompt, /D:\\clawphone/);
});
