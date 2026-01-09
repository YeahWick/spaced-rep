# Spaced Repetition Algorithm

This document describes the spaced repetition algorithm used in the application, based on the SM-2 algorithm with modifications for improved learning outcomes.

## Overview

Spaced repetition is a learning technique that increases intervals between reviews of learned material to exploit the psychological spacing effect. Our implementation is based on the SuperMemo SM-2 algorithm, widely regarded as effective for long-term retention.

## Core Concepts

### Card States

Each card exists in one of three states:

1. **New**: Card has never been reviewed
2. **Learning**: Card is being initially learned (short intervals)
3. **Review**: Card is in the regular review cycle (longer intervals)

### Key Metrics

Each card tracks:

- **Interval**: Days until next review
- **Ease Factor (EF)**: Multiplier for interval calculation (default: 2.5)
- **Repetitions**: Number of successful reviews in a row
- **Due Date**: When the card should next be reviewed
- **Last Review**: When the card was last reviewed

## Algorithm Details

### Quality Ratings

Users rate their recall on a 0-3 scale:

| Rating | Name | Description | Impact |
|--------|------|-------------|--------|
| 0 | Again | Complete blackout | Reset to learning |
| 1 | Hard | Significant difficulty | Reduce interval |
| 2 | Good | Correct with effort | Normal interval |
| 3 | Easy | Perfect recall | Increase interval |

### Interval Calculation

#### For New Cards (Learning Phase)

New cards use fixed short intervals to establish initial memory:

```
Step 1: 1 minute
Step 2: 10 minutes
Step 3: 1 day (graduates to review)
```

If rated "Again" during learning, restart from Step 1.

#### For Review Cards

The interval calculation follows the SM-2 formula:

```javascript
function calculateInterval(card, quality) {
  if (quality === 0) {
    // Failed: reset to learning
    return {
      interval: 1,
      repetitions: 0,
      state: 'learning'
    };
  }

  let interval;
  let easeFactor = card.easeFactor;

  // Adjust ease factor based on quality
  easeFactor = easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor); // Minimum EF of 1.3

  if (card.repetitions === 0) {
    interval = 1;
  } else if (card.repetitions === 1) {
    interval = 6;
  } else {
    interval = Math.round(card.interval * easeFactor);
  }

  // Apply quality modifier
  if (quality === 1) {
    interval = Math.round(interval * 0.8); // Hard: reduce by 20%
  } else if (quality === 3) {
    interval = Math.round(interval * 1.3); // Easy: increase by 30%
  }

  return {
    interval: interval,
    easeFactor: easeFactor,
    repetitions: card.repetitions + 1,
    state: 'review'
  };
}
```

### Ease Factor Adjustment

The ease factor determines how quickly intervals grow. It adjusts based on performance:

```
New EF = Old EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))

Where q = quality rating (0-3)
```

| Quality | EF Change |
|---------|-----------|
| 0 | -0.30 |
| 1 | -0.14 |
| 2 | +0.00 |
| 3 | +0.10 |

The minimum ease factor is capped at 1.3 to prevent intervals from shrinking too aggressively.

## Study Session Management

### Card Selection

Cards are selected for study in this priority order:

1. **Overdue Review Cards**: Cards past their due date (sorted by overdue duration)
2. **Due Review Cards**: Cards due today
3. **Learning Cards**: Cards in the learning phase
4. **New Cards**: Limited number of new cards per day

### Daily Limits

Default limits (configurable):

- **New Cards**: 20 per day per collection
- **Reviews**: 200 per day per collection

### Queue Ordering

Within each category, cards are ordered by:

1. **Review Cards**: Due date (oldest first), then by ease factor (harder cards first)
2. **Learning Cards**: Next step time
3. **New Cards**: Creation order

## Interval Examples

### Successful Review Path

Starting with a new card, rating "Good" (2) each time:

| Review | Interval | Next Review |
|--------|----------|-------------|
| 1 | 1 day | Tomorrow |
| 2 | 6 days | 6 days later |
| 3 | 15 days | ~2 weeks |
| 4 | 38 days | ~1 month |
| 5 | 95 days | ~3 months |

### Mixed Performance Path

A more realistic scenario with varied ratings:

| Review | Rating | Interval | Notes |
|--------|--------|----------|-------|
| 1 | Good (2) | 1 day | First review |
| 2 | Good (2) | 6 days | Normal progression |
| 3 | Hard (1) | 12 days | Reduced from ~15 |
| 4 | Again (0) | 1 day | Reset to learning |
| 5 | Good (2) | 1 day | Relearning |
| 6 | Good (2) | 6 days | Back to review |

## Implementation Notes

### Timezone Handling

- All times stored in UTC
- Due date calculations use local midnight
- Cards due "today" include cards due until end of local day

### Fuzz Factor

To prevent cards from bunching up on the same day, a small random factor (±5%) is applied to intervals greater than 7 days:

```javascript
function applyFuzz(interval) {
  if (interval <= 7) return interval;
  const fuzz = interval * 0.05;
  return Math.round(interval + (Math.random() * 2 - 1) * fuzz);
}
```

### Lapsed Cards

When a review card is rated "Again":

1. Card state changes to "learning"
2. Ease factor is reduced by 0.20 (minimum 1.3)
3. Card goes through abbreviated learning steps
4. Upon graduation, interval is set to previous interval × 0.5 (minimum 1 day)

## Statistics Tracked

For analytics and progress tracking:

- **Total Reviews**: Lifetime review count
- **Retention Rate**: Percentage of reviews rated ≥2
- **Average Ease**: Mean ease factor across cards
- **Streak**: Consecutive days with reviews
- **Time Spent**: Total study time
- **Cards by State**: Count of new/learning/review cards

## References

- [SuperMemo SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Anki Manual - Algorithm](https://docs.ankiweb.net/studying.html#spaced-repetition)
- [Spaced Repetition Research](https://www.gwern.net/Spaced-repetition)
