from secura.dependencies import parse_requirements
from secura.dependencies import scan_dependency_files

def test_parse_requirements():

    dependencies = parse_requirements(
        "tests/fixtures/dependencies/requirements.txt"
    )

    assert len(dependencies) == 3

    names = {dependency["name"] for dependency in dependencies}

    assert "requests" in names
    assert "flask" in names
    assert "numpy" in names

def test_scan_dependency_files(monkeypatch, tmp_path):

    requirements_file = tmp_path / "requirements.txt"

    requirements_file.write_text(
        """
requests==2.31.0
flask==3.0.0
numpy==2.0.0
""",
        encoding="utf-8",
    )

    def fake_scan_dependency(
        package_name,
        version,
        ecosystem,
        file_path,
    ):
        return [
            {
                "type": "Dependency Vulnerability",
                "severity": "HIGH",
                "package": package_name,
                "version": version,
                "ecosystem": ecosystem,
                "vulnerability_id": "GHSA-TEST-1234",
                "summary": "Test vulnerability",
                "file": str(file_path),
            }
        ]

    monkeypatch.setattr(
        "secura.dependencies.scan_dependency",
        fake_scan_dependency,
    )

    findings = scan_dependency_files(tmp_path)

    assert len(findings) == 3

    packages = {
        finding["package"]
        for finding in findings
    }

    assert "requests" in packages
    assert "flask" in packages
    assert "numpy" in packages