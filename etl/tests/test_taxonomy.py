"""Unit tests for the event taxonomy and human/bot classification."""

from src.config import (
    RAW_EVENT_TO_CATEGORY, POSITION_EVENTS, folder_to_date, is_bot,
    CATEGORY_KILL, CATEGORY_DEATH, CATEGORY_LOOT, CATEGORY_STORM,
)


def test_combat_events_fold_into_unified_categories():
    # A kill by the viewed player (vs human OR bot) is a KILL.
    assert RAW_EVENT_TO_CATEGORY["Kill"] == CATEGORY_KILL
    assert RAW_EVENT_TO_CATEGORY["BotKill"] == CATEGORY_KILL
    # Being killed (by human OR bot) is a DEATH.
    assert RAW_EVENT_TO_CATEGORY["Killed"] == CATEGORY_DEATH
    assert RAW_EVENT_TO_CATEGORY["BotKilled"] == CATEGORY_DEATH
    assert RAW_EVENT_TO_CATEGORY["Loot"] == CATEGORY_LOOT
    assert RAW_EVENT_TO_CATEGORY["KilledByStorm"] == CATEGORY_STORM


def test_position_events_are_not_discrete_events():
    assert "Position" in POSITION_EVENTS
    assert "BotPosition" in POSITION_EVENTS
    # Position samples must never be miscategorised as discrete events.
    assert "Position" not in RAW_EVENT_TO_CATEGORY
    assert "BotPosition" not in RAW_EVENT_TO_CATEGORY


def test_bot_vs_human_detection():
    assert is_bot("1440") is True
    assert is_bot("382") is True
    assert is_bot("f4e072fa-b7af-4761-b567-1d95b7ad0108") is False


def test_folder_to_date():
    assert folder_to_date("February_10") == "2026-02-10"
    assert folder_to_date("February_14") == "2026-02-14"
