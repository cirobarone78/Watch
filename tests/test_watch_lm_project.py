"""Tests for the public Watch-LM project template initializer."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "init_watch_lm_project.py"
NOTEBOOK_ID = "11111111-2222-4333-8444-555555555555"


def run_init(root: Path, notebook_id: str = NOTEBOOK_ID) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--project-root",
            str(root),
            "--project",
            "Example",
            "--notebook-id",
            notebook_id,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def test_init_writes_private_mapping_and_gitignore(tmp_path: Path) -> None:
    result = run_init(tmp_path)
    assert result.returncode == 0, result.stderr

    mapping = tmp_path / ".watch-lm" / "notebook.json"
    assert json.loads(mapping.read_text()) == {
        "project": "Example",
        "notebook_id": NOTEBOOK_ID,
        "notebook_url": f"https://notebooklm.google.com/notebook/{NOTEBOOK_ID}",
        "schema_version": 1,
    }
    assert "notebook.json" in (mapping.parent / ".gitignore").read_text()
    assert "runs/" in (mapping.parent / ".gitignore").read_text()


def test_init_is_idempotent_for_same_project(tmp_path: Path) -> None:
    assert run_init(tmp_path).returncode == 0
    assert run_init(tmp_path).returncode == 0


def test_init_hardens_existing_mapping_permissions(tmp_path: Path) -> None:
    if os.name != "posix":
        pytest.skip("POSIX permission bits are not portable to Windows")
    assert run_init(tmp_path).returncode == 0
    private_dir = tmp_path / ".watch-lm"
    mapping = private_dir / "notebook.json"
    private_dir.chmod(0o755)
    mapping.chmod(0o644)

    assert run_init(tmp_path).returncode == 0
    assert private_dir.stat().st_mode & 0o777 == 0o700
    assert mapping.stat().st_mode & 0o777 == 0o600


def test_init_refuses_to_replace_existing_mapping(tmp_path: Path) -> None:
    assert run_init(tmp_path).returncode == 0
    original = (tmp_path / ".watch-lm" / "notebook.json").read_text()
    result = run_init(tmp_path, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
    assert result.returncode != 0
    assert (tmp_path / ".watch-lm" / "notebook.json").read_text() == original


def test_init_rejects_invalid_notebook_id(tmp_path: Path) -> None:
    result = run_init(tmp_path, "not-a-uuid")
    assert result.returncode != 0
    assert not (tmp_path / ".watch-lm" / "notebook.json").exists()


def test_init_rejects_symlinked_private_directory(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    try:
        (tmp_path / ".watch-lm").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("symlink creation is unavailable on this host")

    result = run_init(tmp_path)
    assert result.returncode != 0
    assert not (outside / "notebook.json").exists()


def test_repo_ignores_local_watch_lm_directory() -> None:
    repo = SCRIPT.parents[1]
    result = subprocess.run(
        ["git", "check-ignore", ".watch-lm/notebook.json", ".watch-lm/runs/demo/evidence.md"],
        cwd=repo,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        ".watch-lm/notebook.json",
        ".watch-lm/runs/demo/evidence.md",
    ]
