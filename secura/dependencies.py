import json
import re
from pathlib import Path
from secura.vulnerabilities import scan_dependency

def parse_requirements(file_path):
    dependencies = []

    content = Path(file_path).read_text(encoding="utf-8")

    for line in content.splitlines():
        line = line.strip()

        # Ignore comments and empty lines
        if not line or line.startswith("#"):
            continue

        # Ignore options such as -r, --index-url, etc.
        if line.startswith("-"):
            continue

        match = re.match(
            r"^([A-Za-z0-9_.-]+)\s*([<>=!~]+)\s*([A-Za-z0-9_.+!-]+)",
            line,
        )

        if match:
            dependencies.append(
                {
                    "name": match.group(1),
                    "version": match.group(3),
                    "file": str(file_path),
                }
            )

    return dependencies


def parse_package_json(file_path):
    dependencies = []

    data = json.loads(
        Path(file_path).read_text(encoding="utf-8")
    )

    for section in ["dependencies", "devDependencies"]:
        packages = data.get(section, {})

        for name, version in packages.items():
            dependencies.append(
                {
                    "name": name,
                    "version": version,
                    "file": str(file_path),
                }
            )

    return dependencies


def parse_csproj(file_path):
    dependencies = []

    content = Path(file_path).read_text(encoding="utf-8")

    pattern = re.compile(
        r'<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"',
        re.IGNORECASE,
    )

    for match in pattern.finditer(content):
        dependencies.append(
            {
                "name": match.group(1),
                "version": match.group(2),
                "file": str(file_path),
            }
        )

    return dependencies


def scan_dependencies(directory):
    dependencies = []

    for path in Path(directory).rglob("*"):

        if not path.is_file():
            continue

        if any(
            part in {".git", ".venv", "__pycache__", "tests"}
            for part in path.parts
        ):
            continue

        if path.name == "requirements.txt":
            dependencies.extend(parse_requirements(path))

        elif path.name == "package.json":
            dependencies.extend(parse_package_json(path))

        elif path.suffix.lower() == ".csproj":
            dependencies.extend(parse_csproj(path))

    return dependencies

def scan_dependency_files(directory):
    findings = []

    dependencies = scan_dependencies(directory)

    for dependency in dependencies:
        name = dependency["name"]
        version = dependency["version"]
        file_path = dependency["file"]

        if file_path.endswith("requirements.txt"):
            ecosystem = "PyPI"

        elif file_path.endswith("package.json"):
            ecosystem = "npm"

        elif file_path.endswith(".csproj"):
            ecosystem = "NuGet"

        else:
            continue

        dependency_findings = scan_dependency(
            name,
            version,
            ecosystem,
            file_path,
        )

        findings.extend(dependency_findings)

    return findings