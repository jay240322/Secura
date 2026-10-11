import subprocess


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
            "Make sure the base branch exists locally or as a remote-tracking branch."
        ) from exc

    return [
        filename
        for filename in result.stdout.split("\0")
        if filename
    ]


if __name__ == "__main__":
    for filename in get_changed_files():
        print(filename)