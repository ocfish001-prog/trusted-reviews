"""
AI Polish service — Claude API integration for review assistance.

Three actions:
  - polish:    Fix grammar/clarity without changing meaning
  - structure: Extract pros, cons, verdict from review text
  - prompt:    Suggest 2-3 questions about missing context
"""
import json
from typing import List, Optional

import anthropic

from config import settings

_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM_BASE = (
    "You are a helpful review assistant. "
    "CRITICAL RULES: "
    "NEVER change the reviewer's opinion, tone, or sentiment. "
    "NEVER fabricate details, facts, or experiences not in the original. "
    "NEVER upgrade or downgrade the reviewer's sentiment. "
    "Only work with what the reviewer actually wrote."
)

_POLISH_SYSTEM = _SYSTEM_BASE + (
    " Your job is to fix grammar, spelling, and clarity ONLY. "
    "Max 20% of words may change. Preserve all opinions exactly as written."
)

_STRUCTURE_SYSTEM = _SYSTEM_BASE + (
    " Your job is to extract structured information from the review. "
    "Only use claims the reviewer actually made. "
    "If no cons are mentioned, say 'None mentioned'. "
    "If verdict is unclear, summarize the overall tone in one sentence."
)

_PROMPT_SYSTEM = _SYSTEM_BASE + (
    " Your job is to suggest 2-3 follow-up questions that would help "
    "the reviewer add useful missing context to their review. "
    "Focus on practical details (hours, parking, wait times, specific dishes, etc.). "
    "NEVER ask about sensitive, personal, or demographic information."
)


async def polish_text(text: str) -> str:
    """Fix grammar and clarity without changing meaning. Returns polished text."""
    message = _client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=1024,
        system=_POLISH_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Please lightly polish the following review. "
                    f"Fix grammar and clarity only. Return ONLY the polished text, "
                    f"no preamble or explanation.\n\n{text}"
                ),
            }
        ],
    )
    return message.content[0].text.strip()


async def structure_text(text: str) -> dict:
    """
    Extract pros, cons, and verdict from review text.
    Returns dict with keys: pros, cons, verdict.
    """
    message = _client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=1024,
        system=_STRUCTURE_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract structured information from this review. "
                    "Return a JSON object with these exact keys: "
                    '"pros" (array of strings), '
                    '"cons" (array of strings, or ["None mentioned"]), '
                    '"verdict" (single string). '
                    "Return ONLY valid JSON, no markdown fencing.\n\n"
                    f"{text}"
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


async def generate_prompts(text: str) -> List[str]:
    """
    Suggest 2-3 questions to help reviewer add useful missing context.
    Returns list of question strings.
    """
    message = _client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=512,
        system=_PROMPT_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Based on this review, suggest 2-3 specific follow-up questions "
                    "that would help the reviewer add useful missing details. "
                    "Return a JSON array of question strings. "
                    "Return ONLY valid JSON, no markdown fencing.\n\n"
                    f"{text}"
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
