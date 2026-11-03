import hashlib
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure the root Secura package is importable
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from secura.secrets import scan_file as scan_secrets_file, scan_content
from secura.sast import scan_file as scan_sast_file
from secura.dependencies import scan_dependency_files
from secura.policy import evaluate_policy, load_policy
from secura.remediation import enrich_findings, REMEDIATION_GUIDANCE

logger = logging.getLogger("secura.scanner_service")


def compute_finding_fingerprint(repo_id: str, rule_id: str, file_path: str, line_number: int) -> str:
    """Compute a deterministic hash for deduplication and lifecycle tracking."""
    raw = f"{repo_id}:{rule_id}:{file_path}:{line_number}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def map_type_to_rule_id(finding_type: str) -> str:
    """Standardize finding types to uppercase rule IDs."""
    return finding_type.upper().replace(" ", "_").replace("-", "_")


def run_full_scan(directory: str | Path, policy_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Reuse existing Secura scanner to scan an entire directory.
    Never alters or duplicates the scanner code.
    """
    from secura.scanner import scan_directory

    dir_path = Path(directory).resolve()
    logger.info("Executing Secura full directory scan on %s", dir_path)

    raw_findings = scan_directory(str(dir_path))
    dep_findings = scan_dependency_files(str(dir_path))
    raw_findings.extend(dep_findings)

    policy = load_policy(policy_path) if policy_path else load_policy()
    result = evaluate_policy(raw_findings, policy)
    enriched = enrich_findings(raw_findings)

    return {
        "result": result,
        "findings": enriched,
    }


def scan_file_content(content: str, file_path: str = "<memory>") -> List[Dict[str, Any]]:
    """Scan raw in-memory content for exposed secrets."""
    raw_findings = scan_content(content, file_path=file_path)
    return enrich_findings(raw_findings)


def get_remediation_catalog() -> Dict[str, Dict[str, str]]:
    """Access the structured rule-based remediation guidance catalog."""
    return REMEDIATION_GUIDANCE

