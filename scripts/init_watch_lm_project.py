#!/usr/bin/env python3
"""Bind one local project to one existing NotebookLM notebook."""

import argparse
import json
import os
import sys
from pathlib import Path
from uuid import UUID


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--project", required=True)
    parser.add_argument("--notebook-id", required=True)
    args = parser.parse_args()

    project = args.project.strip()
    if not project:
        parser.error("--project must not be blank")
    try:
        notebook_id = str(UUID(args.notebook_id))
    except ValueError:
        parser.error("--notebook-id must be a valid UUID")

    project_root = args.project_root.expanduser().resolve()
    if not project_root.is_dir():
        parser.error("--project-root must be an existing directory")
    config_dir = project_root / ".watch-lm"
    mapping_path = config_dir / "notebook.json"
    ignore_path = config_dir / ".gitignore"
    if any(path.is_symlink() for path in (config_dir, mapping_path, ignore_path)):
        parser.error(".watch-lm paths must not be symlinks")
    mapping = {
        "project": project,
        "notebook_id": notebook_id,
        "notebook_url": f"https://notebooklm.google.com/notebook/{notebook_id}",
        "schema_version": 1,
    }

    if mapping_path.exists():
        try:
            existing = json.loads(mapping_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            parser.error("existing notebook mapping is unreadable; inspect it manually")
        if existing != mapping:
            parser.error("project is already bound to another notebook; inspect it manually")
    else:
        config_dir.mkdir(mode=0o700, exist_ok=True)
        with mapping_path.open("x", encoding="utf-8") as stream:
            json.dump(mapping, stream, indent=2)
            stream.write("\n")
    if os.name == "posix":
        config_dir.chmod(0o700)
        mapping_path.chmod(0o600)

    required_lines = ("notebook.json", "runs/")
    existing_lines = ignore_path.read_text(encoding="utf-8").splitlines() if ignore_path.exists() else []
    missing_lines = [line for line in required_lines if line not in existing_lines]
    if missing_lines:
        with ignore_path.open("a", encoding="utf-8") as stream:
            if existing_lines:
                stream.write("\n")
            stream.write("\n".join(missing_lines) + "\n")

    print(f"Bound {project!r} to notebook {notebook_id}; mapping stays local at {mapping_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
