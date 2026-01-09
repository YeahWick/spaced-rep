# Data Schema

This document describes the data structures used in the Spaced Repetition Learning Cards application.

## IndexedDB Structure

The application uses IndexedDB with the following object stores:

```
Database: SpacedRepDB (version 1)
├── collections     (keyPath: id)
├── cards          (keyPath: id, index: collectionId)
└── settings       (keyPath: key)
```

## Entity Schemas

### Collection

Represents a deck of flashcards.

```typescript
interface Collection {
  // Unique identifier (UUID v4)
  id: string;

  // Display name
  name: string;

  // Optional description
  description?: string;

  // Creation timestamp (ISO 8601)
  createdAt: string;

  // Last modification timestamp (ISO 8601)
  updatedAt: string;

  // User-defined color for UI (hex)
  color?: string;

  // Study settings for this collection
  settings: CollectionSettings;

  // Cached statistics (updated periodically)
  stats: CollectionStats;
}

interface CollectionSettings {
  // Maximum new cards per day
  newCardsPerDay: number;  // default: 20

  // Maximum reviews per day
  reviewsPerDay: number;   // default: 200

  // Learning steps in minutes
  learningSteps: number[]; // default: [1, 10]

  // Graduating interval (days)
  graduatingInterval: number; // default: 1

  // Easy interval (days)
  easyInterval: number;    // default: 4

  // Starting ease factor
  startingEase: number;    // default: 2.5
}

interface CollectionStats {
  // Total cards in collection
  totalCards: number;

  // Cards by state
  newCards: number;
  learningCards: number;
  reviewCards: number;

  // Cards due today
  dueToday: number;

  // Average ease factor
  averageEase: number;

  // Last studied timestamp
  lastStudied?: string;
}
```

### Card

Represents a single flashcard.

```typescript
interface Card {
  // Unique identifier (UUID v4)
  id: string;

  // Parent collection ID
  collectionId: string;

  // Front side content
  front: CardContent;

  // Back side content
  back: CardContent;

  // Optional tags for organization
  tags: string[];

  // Creation timestamp (ISO 8601)
  createdAt: string;

  // Last modification timestamp (ISO 8601)
  updatedAt: string;

  // Spaced repetition data
  sr: SpacedRepetitionData;
}

interface CardContent {
  // Plain text content
  text: string;

  // HTML formatted content (sanitized)
  html?: string;

  // Attached images (base64 data URIs)
  images: MediaAttachment[];

  // Attached audio (base64 data URIs)
  audio: MediaAttachment[];
}

interface MediaAttachment {
  // Unique identifier for this attachment
  id: string;

  // MIME type (e.g., "image/png", "audio/webm")
  mimeType: string;

  // Base64 data URI
  data: string;

  // Original filename (if uploaded)
  filename?: string;

  // File size in bytes
  size: number;

  // For images: dimensions
  width?: number;
  height?: number;

  // For audio: duration in seconds
  duration?: number;
}

interface SpacedRepetitionData {
  // Card state
  state: 'new' | 'learning' | 'review';

  // Current interval in days
  interval: number;

  // Ease factor (multiplier for intervals)
  easeFactor: number;

  // Number of consecutive correct reviews
  repetitions: number;

  // Next review due date (ISO 8601, date only)
  dueDate: string | null;

  // Last review timestamp (ISO 8601)
  lastReview: string | null;

  // Current learning step (0-indexed, for learning state)
  learningStep: number;

  // Review history for analytics
  history: ReviewRecord[];
}

interface ReviewRecord {
  // Review timestamp (ISO 8601)
  date: string;

  // Quality rating (0-3)
  quality: number;

  // Interval at time of review
  interval: number;

  // Ease factor at time of review
  easeFactor: number;

  // Time spent viewing card (milliseconds)
  timeSpent: number;
}
```

### Settings

Application-wide user settings.

```typescript
interface Settings {
  // Setting key (e.g., "theme", "defaultNewCards")
  key: string;

  // Setting value (JSON serializable)
  value: any;
}

// Known settings keys and their types
interface KnownSettings {
  // UI theme
  theme: 'light' | 'dark' | 'system';

  // Default new cards per day for new collections
  defaultNewCardsPerDay: number;

  // Default reviews per day for new collections
  defaultReviewsPerDay: number;

  // Show time estimates during study
  showTimeEstimates: boolean;

  // Auto-play audio when card is shown
  autoPlayAudio: boolean;

  // Keyboard shortcuts enabled
  keyboardShortcuts: boolean;

  // Last selected collection ID
  lastCollection: string | null;

  // Tutorial completed flag
  tutorialCompleted: boolean;

  // Image compression quality (0-1)
  imageQuality: number;

  // Maximum image dimension (pixels)
  maxImageSize: number;
}
```

## Export Format

The `.srep` export file format:

```typescript
interface ExportFile {
  // Format version for migration support
  version: '1.0';

  // Export timestamp (ISO 8601)
  exportDate: string;

  // Application version that created export
  appVersion: string;

  // Exported collection
  collection: Collection;

  // All cards in the collection
  cards: Card[];

  // Checksum for integrity verification
  checksum: string;
}
```

### Export File Structure

```json
{
  "version": "1.0",
  "exportDate": "2024-01-15T10:30:00.000Z",
  "appVersion": "1.0.0",
  "collection": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Spanish Vocabulary",
    "description": "Common Spanish words and phrases",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "settings": {
      "newCardsPerDay": 20,
      "reviewsPerDay": 200,
      "learningSteps": [1, 10],
      "graduatingInterval": 1,
      "easyInterval": 4,
      "startingEase": 2.5
    },
    "stats": {
      "totalCards": 150,
      "newCards": 50,
      "learningCards": 10,
      "reviewCards": 90,
      "dueToday": 25,
      "averageEase": 2.4
    }
  },
  "cards": [
    {
      "id": "card-uuid-1",
      "collectionId": "550e8400-e29b-41d4-a716-446655440000",
      "front": {
        "text": "Hello",
        "images": [],
        "audio": []
      },
      "back": {
        "text": "Hola",
        "images": [],
        "audio": [
          {
            "id": "audio-1",
            "mimeType": "audio/webm",
            "data": "data:audio/webm;base64,GkXfo59ChoE...",
            "duration": 1.5
          }
        ]
      },
      "tags": ["greetings", "basics"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-10T00:00:00.000Z",
      "sr": {
        "state": "review",
        "interval": 15,
        "easeFactor": 2.5,
        "repetitions": 4,
        "dueDate": "2024-01-20",
        "lastReview": "2024-01-05T14:30:00.000Z",
        "learningStep": 0,
        "history": []
      }
    }
  ],
  "checksum": "sha256:abc123..."
}
```

## Indexes

### Cards Store Indexes

| Index Name | Key Path | Unique | Purpose |
|------------|----------|--------|---------|
| collectionId | collectionId | No | Query cards by collection |
| dueDate | sr.dueDate | No | Query due cards |
| state | sr.state | No | Filter by card state |
| tags | tags | No (multiEntry) | Search by tag |

## Data Validation

### Collection Validation

```javascript
const collectionSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  description: {
    maxLength: 500
  },
  color: {
    pattern: /^#[0-9A-Fa-f]{6}$/
  }
};
```

### Card Validation

```javascript
const cardSchema = {
  front: {
    text: {
      required: true,
      minLength: 1,
      maxLength: 10000
    },
    images: {
      maxCount: 10,
      maxSizeEach: 5 * 1024 * 1024  // 5MB
    },
    audio: {
      maxCount: 5,
      maxSizeEach: 10 * 1024 * 1024 // 10MB
    }
  },
  back: {
    // Same as front
  },
  tags: {
    maxCount: 20,
    maxLengthEach: 50
  }
};
```

## Migration Strategy

When the schema version changes:

1. Check current database version on open
2. If older, run migration functions in sequence
3. Each migration transforms data from version N to N+1
4. Update database version after successful migration

```javascript
const migrations = {
  1: (db) => {
    // Initial schema - no migration needed
  },
  2: (db) => {
    // Example: Add new field to cards
    // Iterate all cards, add default value for new field
  }
};
```
