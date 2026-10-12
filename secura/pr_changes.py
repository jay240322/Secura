
import subprocess
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cs", ".php", ".go",
    ".rb", ".cpp", ".c", ".h", ".json", ".yaml", ".yml", ".xml", ".env",
    ".ini", ".config", ".properties", ".toml",
}

DEPENDENCY_MANIFESTS = {
    "requirements.txt",
    "package.json",
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
    """Return changed source files that Secura knows how to scan."""
    scannable = []

    for filename in get_changed_files(base_ref):
        path = Path(filename)

        if any(part in IGNORED_PARTS for part in path.parts):
            continue

        if path.suffix.lower() in ALLOWED_EXTENSIONS:
            scannable.append(filename)

    return scannable


def get_changed_dependency_files(base_ref="origin/main"):
    """Return paths of added, copied, modified, or renamed dependency manifests.

    Compare HEAD with its merge base with ``base_ref`` in the current working
    directory's repository; uncommitted changes are excluded. Match exact names
    ``requirements.txt`` and ``package.json`` or a case-insensitive ``.csproj``
    suffix, excluding paths with a component in ``IGNORED_PARTS``.

    Return Git's path strings without checking whether the files still exist.
    Raise RuntimeError if Git rejects the comparison; errors starting Git,
    such as FileNotFoundError when Git is unavailable, propagate.
    """
    manifests = []

    for filename in get_changed_files(base_ref):
        path = Path(filename)

        if any(part in IGNORED_PARTS for part in path.parts):
            continue

        if (
            path.name in DEPENDENCY_MANIFESTS
            or path.suffix.lower() == ".csproj"
        ):
            manifests.append(filename)

    return manifests


if __name__ == "__main__":
    for filename in get_scannable_changed_files():
        print(filename)

    for filename in get_changed_dependency_files():
        print(f"Dependency manifest: {filename}")
