import subprocess
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cs", ".php", ".go",
    ".rb", ".cpp", ".c", ".h", ".json", ".yaml", ".yml", ".xml", ".env",
    ".ini", ".config", ".properties", ".toml",
}

IGNORED_PARTS = {".git", ".venv", "__pycache__", "tests"}


def get_changed_files(base_ref="origin/main"):
    """Return added, copied, modified, and renamed files relative to base_ref."""
    try:
        result = subprocess.run(
            [
                "git",
                "diff",
                "--name-only",
                "--diff-filter=ACMR",
                "-z",
                f"{base_ref}...HEAD",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"Could not compare HEAD with {base_ref}. "
            "Make sure the base branch exists locally or remotely."
        ) from exc

    return [
        filename
        for filename in result.stdout.split("\0")
        if filename
    ]


def get_scannable_changed_files(base_ref="origin/main"):
    """Return changed files that Secura knows how to scan."""
    scannable = []

    for filename in get_changed_files(base_ref):
        path = Path(filename)

        if any(part in IGNORED_PARTS for part in path.parts):
            continue

        if path.suffix.lower() in ALLOWED_EXTENSIONS:
            scannable.append(filename)

    return scannable


if __name__ == "__main__":
    for filename in get_scannable_changed_files():
        print(filename)