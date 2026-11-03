import subprocess
from pathlib import Path

SCANNABLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cs", ".php", ".go",
    ".rb", ".cpp", ".c", ".h", ".json", ".yaml", ".yml", ".xml",
    ".ini", ".config", ".properties", ".toml", ".sh", ".bash", ".zsh",
    ".pem", ".key", ".crt", ".conf", ".cfg", ".txt",
}

DEPENDENCY_MANIFESTS = {
    "requirements.txt",
    "package.json",
}

IGNORED_PARTS = {".git", ".venv", "__pycache__", "tests", "node_modules", ".next"}


def is_scannable_file(filename_or_path: str | Path) -> bool:
    """Check if a file should be scanned by Secura."""
    path = Path(filename_or_path)

    if any(part in IGNORED_PARTS for part in path.parts):
        return False

    # Check .env and variants (.env.local, .env.prod, etc.)
    if path.name == ".env" or path.name.startswith(".env."):
        return True

    # Check known sensitive credential filenames
    if path.name.lower() in {"credentials", "secrets", "id_rsa", "id_ed25519"}:
        return True

    return path.suffix.lower() in SCANNABLE_EXTENSIONS


def get_changed_files(base_ref="origin/main") -> list[str]:
    """Return added, copied, modified, and renamed files relative to base_ref."""
    refs_to_try = [base_ref]
    if base_ref == "origin/main":
        refs_to_try.extend(["main", "HEAD~1"])

    last_error = None
    for ref in refs_to_try:
        try:
            result = subprocess.run(
                [
                    "git",
                    "diff",
                    "--name-only",
                    "--diff-filter=ACMR",
                    "-z",
                    f"{ref}...HEAD",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            return [
                filename
                for filename in result.stdout.split("\0")
                if filename
            ]
        except subprocess.CalledProcessError as exc:
            last_error = exc
            continue

    raise RuntimeError(
        f"Could not compare HEAD with {base_ref}. "
        "Make sure the base branch exists locally or remotely."
    ) from last_error


def get_scannable_changed_files(base_ref="origin/main") -> list[str]:
    """Return changed source files that Secura knows how to scan."""
    return [
        filename
        for filename in get_changed_files(base_ref)
        if is_scannable_file(filename)
    ]


def get_changed_dependency_files(base_ref="origin/main") -> list[str]:
    """Return changed supported dependency manifests."""
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
