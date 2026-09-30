# Project-scoped NotebookLM memory

The optional [`/watch-lm`](../../skills/watch-lm/SKILL.md) skill combines
Watch Skill's local, timestamped visual evidence with a NotebookLM notebook
that the user selects for the current project. This is an agent workflow,
**not** a NotebookLM MCP server or a change to Watch Skill's engine. It does
not add Google authentication, credentials, or notebook IDs to this repository.

## Requirements

1. Install Watch Skill and run `watch-skill doctor --json`. An MCP-capable
   agent can connect Watch Skill with `watch-skill serve` if it is not already
   configured; see the [agent setup guides](../agents/README.md).
2. Install the `watch-lm` skill from this repository's `skills/` directory.
   For Codex, copy `skills/watch-lm/SKILL.md` to
   `${CODEX_HOME:-$HOME/.codex}/skills/watch-lm/SKILL.md` and restart Codex.
3. Connect a separate, authenticated NotebookLM-compatible MCP server to
   **your own** account. It must support notebook selection, source addition,
   source-grounded queries, and notes. Unofficial servers vary in tool names
   and behavior; review one before granting it access. This repository does
   not package, endorse, or install one.

## Bind one project to one notebook

Create or choose a notebook first. From this repository, run:

```bash
python3 scripts/init_watch_lm_project.py \
  --project-root /path/to/your-project \
  --project "Example Project" \
  --notebook-id <your-notebook-uuid>
```

The initializer writes the mapping to the project's
`.watch-lm/notebook.json`, requests owner-only permissions on POSIX, and creates
`.watch-lm/.gitignore` to exclude the mapping and `runs/`. It refuses to
replace an existing binding with a different notebook. The UUID above is a
placeholder; never commit a real mapping, session cookie, credential,
transcript, or private video frame. Verify the project's own ignore rules
before using `git add .`.

Within that project, invoke `/watch-lm <video-url-or-path> <learning goal>`.
The skill records Watch evidence locally, requests permission before any
NotebookLM upload, queries only the mapped notebook, and marks each claim in
its spec as confirmed, single-source, or conflicting. For private/local
media, uploading the media or derived evidence needs explicit authorization
for those data. If the NotebookLM MCP is unavailable, the local Watch
evidence remains usable, but the agent must not claim the notebook was
updated. NotebookLM's YouTube import is transcript-based, so on-screen steps
must still be checked against Watch's frames and OCR.
