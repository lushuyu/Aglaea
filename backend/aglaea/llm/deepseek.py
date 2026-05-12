"""DeepSeek V4 Pro HTTP client (raw httpx, explicit 60s timeout).

DeepSeek auto-caches identical prefixes — we structure prompts in
`llm/prompts.py` so service-stable text is at the front. No explicit
cache_control headers needed.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from aglaea.config import DEEPSEEK_TIMEOUT_SECONDS

log = logging.getLogger(__name__)


class DeepSeekError(RuntimeError):
    """Wraps any HTTP / parsing failure surfaced by `DeepSeekClient.generate`."""


class DeepSeekClient:
    """Thin wrapper around DeepSeek's OpenAI-compatible /chat/completions."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.deepseek.com",
        model: str = "deepseek-chat",
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def generate(
        self,
        *,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.4,
    ) -> str:
        """POST /chat/completions and return the assistant content."""
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=DEEPSEEK_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self._base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise DeepSeekError(f"transport: {exc}") from exc

        if response.status_code >= 400:
            raise DeepSeekError(
                f"http {response.status_code}: {response.text[:500]}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise DeepSeekError(f"non-json body: {exc}") from exc

        try:
            return str(body["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            raise DeepSeekError(f"unexpected response shape: {exc}") from exc
