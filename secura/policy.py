from pathlib import Path

import yaml


DEFAULT_POLICY = {
    "max_critical": 0,
    "max_high": 0,
    "max_medium": 5,
    "max_low": 10,
    "minimum_score": 80,
}


def load_policy(policy_path="config/security-policy.yml"):
    path = Path(policy_path)

    if not path.exists():
        return DEFAULT_POLICY.copy()

    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file) or {}

    policy = data.get("policy", {})

    return {
        "max_critical": policy.get("max_critical", 0),
        "max_high": policy.get("max_high", 0),
        "max_medium": policy.get("max_medium", 5),
        "max_low": policy.get("max_low", 10),
        "minimum_score": policy.get("minimum_score", 80),
    }


def calculate_score(findings):
    score = 100

    severity_penalties = {
        "CRITICAL": 30,
        "HIGH": 20,
        "MEDIUM": 10,
        "LOW": 5,
    }

    for finding in findings:
        severity = finding.get("severity", "MEDIUM").upper()
        score -= severity_penalties.get(severity, 10)

    return max(score, 0)


def evaluate_policy(findings, policy):
    counts = {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0,
    }

    for finding in findings:
        severity = finding.get("severity", "MEDIUM").upper()

        if severity in counts:
            counts[severity] += 1

    score = calculate_score(findings)

    failures = []

    if counts["CRITICAL"] > policy["max_critical"]:
        failures.append(
            f"Critical findings: {counts['CRITICAL']} "
            f"(maximum allowed: {policy['max_critical']})"
        )

    if counts["HIGH"] > policy["max_high"]:
        failures.append(
            f"High findings: {counts['HIGH']} "
            f"(maximum allowed: {policy['max_high']})"
        )

    if counts["MEDIUM"] > policy["max_medium"]:
        failures.append(
            f"Medium findings: {counts['MEDIUM']} "
            f"(maximum allowed: {policy['max_medium']})"
        )

    if counts["LOW"] > policy["max_low"]:
        failures.append(
            f"Low findings: {counts['LOW']} "
            f"(maximum allowed: {policy['max_low']})"
        )

    if score < policy["minimum_score"]:
        failures.append(
            f"Security score: {score} "
            f"(minimum required: {policy['minimum_score']})"
        )

    return {
        "passed": len(failures) == 0,
        "score": score,
        "counts": counts,
        "failures": failures,
    }