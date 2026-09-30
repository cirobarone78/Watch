---
name: watch-lm
version: "1.4.3"
description: Turn a video or tutorial into source-grounded, reusable agent knowledge using Watch Skill evidence and one NotebookLM notebook per project. Use when the user asks an agent to learn a workflow from video, preserve it, or build a repeatable skill; do not treat NotebookLM output as execution proof.
argument-hint: "<video-url-or-path> [learning goal]"
allowed-tools: Bash, Read, AskUserQuestion
license: MIT
user-invocable: true
---

# /watch-lm

Use Watch Skill for local visual/transcript evidence and NotebookLM as the project's curated source library. This is an agent skill that coordinates the Watch CLI with a separately configured NotebookLM MCP, not a standalone NotebookLM server. The project notebook is selected from `.watch-lm/notebook.json`; never silently use another project's notebook.

## Project boundary

1. Resolve the project root from the current working directory.
2. Read `.watch-lm/notebook.json`. It must contain `project`, `notebook_id`, and `notebook_url`.
3. If it is missing, stop and ask the user to choose/create the notebook. The repository's `scripts/init_watch_lm_project.py` can create this local mapping. Never add sources to a guessed notebook.
4. Keep one notebook mapping per project. Do not create a second notebook for a new video in the same project.

## Workflow

1. Run `watch-skill doctor --json`. If it reports only optional warnings, continue; stop on missing required acquisition tools.
2. Run Watch Skill before asking NotebookLM anything:

```bash
watch-skill watch "<source>" --out-dir .watch-lm/runs/<run-id>
```

Use `--start/--end` for a focused section and `--resolution 1024` when terminal/code text must be read. Use `--transcript-only` only when visual evidence is irrelevant. Keep the command output and the generated report in the run directory.
3. Read every frame path returned by Watch Skill. Treat the transcript, OCR, frames, and timestamps as evidence. Do not infer unreadable commands or settings.
4. Write `.watch-lm/runs/<run-id>/evidence.md` containing: source URL/path, exact command, Watch Skill version, timestamps, observed text, visual observations, uncertainties, and the learning goal.
5. Before uploading anything to NotebookLM, explain which URL or evidence text will be sent and obtain user approval when not already explicitly authorized. Add a public YouTube/web URL through the connected NotebookLM MCP's source-add capability. Add `evidence.md` as a file or text source only after checking it for secrets and private information. For local/private media, do not upload the video or evidence unless explicitly authorized for those data.
6. Ask NotebookLM a source-grounded question through the connected MCP's notebook-query capability: extract prerequisites, exact commands, ordered steps, gotchas, and what the sources do not establish. Require citations/source IDs in the answer.
7. Produce `.watch-lm/runs/<run-id>/spec.md` with three labels on every claim:
   - `CONFIRMED`: visible in Watch evidence and supported by NotebookLM sources.
   - `SINGLE_SOURCE`: supported by only one evidence stream; keep but mark it.
   - `CONFLICT`: evidence disagrees or is incomplete; do not average it; list the verification needed.
8. If asked to create a reusable skill, use the repository's skill-creator workflow from `spec.md`. Preserve `evidence.md`, `spec.md`, and the source URL as provenance. A skill is not trusted until it runs once on a real input.
9. With approval for a NotebookLM write, add a concise run note with the spec path, evidence path, test status, and unresolved questions. Do not add speculative conclusions as facts.

## Source-of-truth rules

- NotebookLM is the long-term, source-grounded memory; it is not a test oracle.
- Watch evidence is the visual authority for text/settings shown on screen.
- The saved local `spec.md` and a successful test are the execution authority. If version control is needed, export a reviewed, sanitized copy outside the ignored `.watch-lm/` directory.
- Agreement between Watch and NotebookLM is not independent proof if both used the same transcript.
- Never upload credentials, cookies, private browser profiles, or unrelated personal files.
- Do not claim that a notebook exists or is connected until its MCP tool confirms it; if the NotebookLM integration is absent, keep the local evidence and stop before upload/query.
- Do not spend credits, publish, or change external systems while learning a tutorial without explicit user approval.

## Follow-up

For a follow-up about an already processed run, query the mapped NotebookLM notebook and read the saved evidence/spec first. Do not re-run Watch unless the question requires visual evidence missing from the run.
