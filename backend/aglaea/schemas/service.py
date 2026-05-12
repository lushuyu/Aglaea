"""Service admin / response schemas (Pydantic strict)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ServiceKindLiteral = Literal["push", "pull"]


class ServiceCreate(BaseModel):
    """Admin create payload (Pydantic strict, extras → 400)."""

    model_config = ConfigDict(extra="forbid", strict=True)

    slug: str = Field(pattern=r"^[a-z][a-z0-9-]{1,30}$")
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    kind: ServiceKindLiteral
    public_visible: bool = True
    expected_interval_seconds: int | None = Field(default=None, ge=1)
    probe_url: str | None = Field(default=None, max_length=2000)
    probe_interval_seconds: int | None = Field(default=60, ge=10)
    probe_timeout_seconds: int | None = Field(default=10, ge=1, le=60)
    probe_expected_status: int | None = Field(default=200, ge=100, le=599)
    deepseek_context: str | None = Field(default=None, max_length=10_000)

    @field_validator("probe_url")
    @classmethod
    def _validate_probe_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        v = value.strip()
        if not v:
            return None
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("probe_url must start with http:// or https://")
        return v


class ServiceUpdate(BaseModel):
    """Partial update — all fields optional."""

    model_config = ConfigDict(extra="forbid", strict=True)

    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    public_visible: bool | None = None
    expected_interval_seconds: int | None = Field(default=None, ge=1)
    probe_url: str | None = Field(default=None, max_length=2000)
    probe_interval_seconds: int | None = Field(default=None, ge=10)
    probe_timeout_seconds: int | None = Field(default=None, ge=1, le=60)
    probe_expected_status: int | None = Field(default=None, ge=100, le=599)
    deepseek_context: str | None = Field(default=None, max_length=10_000)


class ServiceAdminOut(BaseModel):
    """Admin response model — full field set is allowed for admins."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    display_name: str
    description: str | None
    kind: ServiceKindLiteral
    public_visible: bool
    expected_interval_seconds: int | None
    probe_url: str | None
    probe_interval_seconds: int | None
    probe_timeout_seconds: int | None
    probe_expected_status: int | None
    last_heartbeat_at: datetime | None
    last_status: str | None
    last_subchecks: dict[str, Any] | None
    last_message: str | None
    deepseek_context: str | None
    created_at: datetime
    updated_at: datetime


class ApiKeyCreate(BaseModel):
    """Generate a new bearer token for a service."""

    model_config = ConfigDict(extra="forbid", strict=True)

    label: str = Field(min_length=1, max_length=100)


class ApiKeyOut(BaseModel):
    """Returned without plaintext."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    service_id: int
    label: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class ApiKeyCreatedOnce(BaseModel):
    """One-shot response — `plaintext` returned exactly once at generation."""

    model_config = ConfigDict(from_attributes=False)

    id: int
    label: str
    key_prefix: str
    plaintext: str
