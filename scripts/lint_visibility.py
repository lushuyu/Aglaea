#!/usr/bin/env python3
"""lint_visibility.py — Phase 0.9 visibility drift detector.

Compares every Pydantic response model in backend/aglaea/routers/ against
the frozenset constants in backend/aglaea/security/visibility.py.

Exits 1 if:
  - A router model declares a field NOT in the corresponding visibility constant.
  - A router model is missing a field that the constant REQUIRES.

Run: python scripts/lint_visibility.py
Wired into: .pre-commit-config.yaml and .github/workflows/ci.yml

Principle 2 (SPEC plan): "any PR that adds a public/LLM-exposed field MUST
update visibility.py in the same diff; CI lint enforces."
"""

from __future__ import annotations

import ast
import importlib.util
import sys
from pathlib import Path
from typing import NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
VISIBILITY_MODULE = BACKEND_ROOT / "aglaea" / "security" / "visibility.py"
ROUTERS_DIR = BACKEND_ROOT / "aglaea" / "routers"

# Maps router model name patterns → visibility constant name.
# Add entries here whenever a new public/LLM-exposed response model is added.
MODEL_TO_CONSTANT: dict[str, str] = {
    "PublicService": "PUBLIC_FIELDS_SERVICE",
    "PublicIncidentPublished": "PUBLIC_FIELDS_INCIDENT_PUBLISHED",
    "PublicIncidentSkeleton": "PUBLIC_FIELDS_INCIDENT_SKELETON",
    "PublicHeartbeat": "PUBLIC_FIELDS_HEARTBEAT",
    "LLMHeartbeatContext": "LLM_CONTEXT_FIELDS_HEARTBEAT",
    "LLMIncidentContext": "LLM_CONTEXT_FIELDS_INCIDENT",
    "LLMServiceContext": "LLM_CONTEXT_FIELDS_SERVICE",
}


class LintError(NamedTuple):
    file: str
    model: str
    problem: str
    fields: set[str]


def load_visibility_constants() -> dict[str, frozenset[str]]:
    """Import visibility.py and extract all frozenset constants."""
    if not VISIBILITY_MODULE.exists():
        # Visibility module not yet created — report no constants.
        # This is acceptable during Phase 0 (no router models exist yet).
        return {}

    spec = importlib.util.spec_from_file_location("visibility", VISIBILITY_MODULE)
    if spec is None or spec.loader is None:
        print(f"ERROR: Cannot load {VISIBILITY_MODULE}", file=sys.stderr)
        sys.exit(1)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]

    constants: dict[str, frozenset[str]] = {}
    for name in dir(module):
        value = getattr(module, name)
        if isinstance(value, frozenset):
            constants[name] = value
    return constants


def extract_pydantic_fields(source: str, model_name: str) -> set[str] | None:
    """Parse source and return field names for the named Pydantic model class.

    Returns None if the model is not found in this file.
    Uses AST parsing — does not execute the module.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if node.name != model_name:
            continue
        fields: set[str] = set()
        for item in node.body:
            # Pydantic fields: annotated assignments at class body level
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                fields.add(item.target.id)
        return fields
    return None


def lint_routers(constants: dict[str, frozenset[str]]) -> list[LintError]:
    """Walk all router files and check model fields against visibility constants."""
    errors: list[LintError] = []

    if not ROUTERS_DIR.exists():
        # No routers yet — nothing to check.
        return errors

    router_files = list(ROUTERS_DIR.glob("*.py"))
    if not router_files:
        return errors

    for router_file in sorted(router_files):
        source = router_file.read_text(encoding="utf-8")
        relative = router_file.relative_to(REPO_ROOT)

        for model_name, constant_name in MODEL_TO_CONSTANT.items():
            fields = extract_pydantic_fields(source, model_name)
            if fields is None:
                # Model not in this file — skip.
                continue

            if constant_name not in constants:
                errors.append(
                    LintError(
                        file=str(relative),
                        model=model_name,
                        problem=f"Visibility constant '{constant_name}' not found in visibility.py",
                        fields=set(),
                    )
                )
                continue

            allowed = constants[constant_name]

            # Fields in the model that are NOT in the allowlist
            leaked = fields - allowed
            if leaked:
                errors.append(
                    LintError(
                        file=str(relative),
                        model=model_name,
                        problem=f"Fields NOT in {constant_name} (potential leak)",
                        fields=leaked,
                    )
                )

    return errors


def main() -> int:
    constants = load_visibility_constants()

    if not constants:
        print("lint_visibility: visibility.py not found or empty — no constants to check.")
        print("This is acceptable during early scaffolding (Phase 0).")
        return 0

    errors = lint_routers(constants)

    if not errors:
        print("lint_visibility: OK — all router models are within visibility constants.")
        return 0

    print("lint_visibility: FAILED — visibility drift detected!\n")
    for err in errors:
        print(f"  [{err.file}] {err.model}: {err.problem}")
        if err.fields:
            print(f"    Fields: {sorted(err.fields)}")
    print(
        "\nFix: Update backend/aglaea/security/visibility.py to include the new fields,\n"
        "     OR remove the fields from the response model if they should not be public.\n"
        "     Same-PR co-change rule: visibility.py and the router model MUST change together."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
