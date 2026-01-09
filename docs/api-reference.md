# API Reference

This document provides detailed API documentation for all JavaScript modules in the Spaced Repetition Learning Cards application.

## Table of Contents

- [Storage Module](#storage-module)
- [SR Algorithm Module](#sr-algorithm-module)
- [Media Module](#media-module)
- [Export Module](#export-module)
- [App Module](#app-module)

---

## Storage Module

**File:** `js/storage.js`

Handles all IndexedDB operations with a promise-based API.

### Initialization

#### `Storage.init()`

Initializes the database connection. Must be called before any other operations.

```javascript
await Storage.init();
```

**Returns:** `Promise<void>`

**Throws:** `StorageError` if database cannot be opened

---

### Collections API

#### `Storage.collections.getAll()`

Retrieves all collections.

```javascript
const collections = await Storage.collections.getAll();
```

**Returns:** `Promise<Collection[]>`

---

#### `Storage.collections.get(id)`

Retrieves a single collection by ID.

```javascript
const collection = await Storage.collections.get('uuid-here');
```

**Parameters:**
- `id` (string): Collection UUID

**Returns:** `Promise<Collection | null>`

---

#### `Storage.collections.create(data)`

Creates a new collection.

```javascript
const collection = await Storage.collections.create({
  name: 'My Collection',
  description: 'Optional description'
});
```

**Parameters:**
- `data` (object):
  - `name` (string, required): Collection name
  - `description` (string, optional): Collection description
  - `color` (string, optional): Hex color code
  - `settings` (object, optional): Collection settings override

**Returns:** `Promise<Collection>` - The created collection with generated ID

---

#### `Storage.collections.update(id, data)`

Updates an existing collection.

```javascript
await Storage.collections.update('uuid-here', {
  name: 'Updated Name'
});
```

**Parameters:**
- `id` (string): Collection UUID
- `data` (object): Fields to update

**Returns:** `Promise<Collection>` - The updated collection

---

#### `Storage.collections.delete(id)`

Deletes a collection and all its cards.

```javascript
await Storage.collections.delete('uuid-here');
```

**Parameters:**
- `id` (string): Collection UUID

**Returns:** `Promise<void>`

---

### Cards API

#### `Storage.cards.getByCollection(collectionId)`

Gets all cards in a collection.

```javascript
const cards = await Storage.cards.getByCollection('collection-uuid');
```

**Parameters:**
- `collectionId` (string): Collection UUID

**Returns:** `Promise<Card[]>`

---

#### `Storage.cards.get(id)`

Gets a single card by ID.

```javascript
const card = await Storage.cards.get('card-uuid');
```

**Parameters:**
- `id` (string): Card UUID

**Returns:** `Promise<Card | null>`

---

#### `Storage.cards.create(data)`

Creates a new card.

```javascript
const card = await Storage.cards.create({
  collectionId: 'collection-uuid',
  front: {
    text: 'Question',
    images: [],
    audio: []
  },
  back: {
    text: 'Answer',
    images: [],
    audio: []
  },
  tags: ['tag1', 'tag2']
});
```

**Parameters:**
- `data` (object): Card data (see data-schema.md)

**Returns:** `Promise<Card>` - The created card with generated ID and SR data

---

#### `Storage.cards.update(id, data)`

Updates an existing card.

```javascript
await Storage.cards.update('card-uuid', {
  front: { text: 'Updated question', images: [], audio: [] }
});
```

**Parameters:**
- `id` (string): Card UUID
- `data` (object): Fields to update

**Returns:** `Promise<Card>` - The updated card

---

#### `Storage.cards.delete(id)`

Deletes a card.

```javascript
await Storage.cards.delete('card-uuid');
```

**Parameters:**
- `id` (string): Card UUID

**Returns:** `Promise<void>`

---

#### `Storage.cards.getDue(collectionId, date?)`

Gets cards due for review.

```javascript
const dueCards = await Storage.cards.getDue('collection-uuid');
// Or with specific date:
const dueCards = await Storage.cards.getDue('collection-uuid', new Date('2024-01-15'));
```

**Parameters:**
- `collectionId` (string): Collection UUID
- `date` (Date, optional): Date to check against (defaults to today)

**Returns:** `Promise<Card[]>` - Cards due for review

---

### Settings API

#### `Storage.settings.get(key)`

Gets a setting value.

```javascript
const theme = await Storage.settings.get('theme');
```

**Parameters:**
- `key` (string): Setting key

**Returns:** `Promise<any>` - Setting value or undefined

---

#### `Storage.settings.set(key, value)`

Sets a setting value.

```javascript
await Storage.settings.set('theme', 'dark');
```

**Parameters:**
- `key` (string): Setting key
- `value` (any): Setting value (must be JSON serializable)

**Returns:** `Promise<void>`

---

## SR Algorithm Module

**File:** `js/sr-algorithm.js`

Implements the spaced repetition algorithm.

### `SRAlgorithm.calculateNextReview(card, quality)`

Calculates the next review parameters for a card.

```javascript
const updates = SRAlgorithm.calculateNextReview(card, 2);
// Returns: { interval, easeFactor, repetitions, dueDate, state, learningStep }
```

**Parameters:**
- `card` (Card): The card being reviewed
- `quality` (number): Rating 0-3

**Returns:** `object` - Updated SR fields

---

### `SRAlgorithm.getDueCards(cards, date?)`

Filters cards that are due for review.

```javascript
const dueCards = SRAlgorithm.getDueCards(allCards);
```

**Parameters:**
- `cards` (Card[]): Array of cards to filter
- `date` (Date, optional): Date to check against

**Returns:** `Card[]` - Cards due for review

---

### `SRAlgorithm.getNewCards(cards, limit)`

Gets new cards up to the daily limit.

```javascript
const newCards = SRAlgorithm.getNewCards(allCards, 20);
```

**Parameters:**
- `cards` (Card[]): Array of cards
- `limit` (number): Maximum new cards

**Returns:** `Card[]` - New cards to study

---

### `SRAlgorithm.sortStudyQueue(cards)`

Sorts cards into optimal study order.

```javascript
const sortedCards = SRAlgorithm.sortStudyQueue(cards);
```

**Parameters:**
- `cards` (Card[]): Cards to sort

**Returns:** `Card[]` - Sorted cards

---

### `SRAlgorithm.getStudyStats(cards)`

Calculates statistics for a set of cards.

```javascript
const stats = SRAlgorithm.getStudyStats(cards);
// Returns: { total, new, learning, review, dueToday, averageEase }
```

**Parameters:**
- `cards` (Card[]): Cards to analyze

**Returns:** `object` - Statistics object

---

## Media Module

**File:** `js/media.js`

Handles image and audio processing.

### `Media.processImage(file, options?)`

Processes an image file for storage.

```javascript
const attachment = await Media.processImage(file, {
  maxWidth: 800,
  maxHeight: 600,
  quality: 0.8
});
```

**Parameters:**
- `file` (File): Image file
- `options` (object, optional):
  - `maxWidth` (number): Maximum width in pixels
  - `maxHeight` (number): Maximum height in pixels
  - `quality` (number): JPEG quality 0-1

**Returns:** `Promise<MediaAttachment>`

---

### `Media.startRecording()`

Starts audio recording.

```javascript
await Media.startRecording();
```

**Returns:** `Promise<void>`

**Throws:** `MediaError` if microphone access denied

---

### `Media.stopRecording()`

Stops recording and returns the audio.

```javascript
const attachment = await Media.stopRecording();
```

**Returns:** `Promise<MediaAttachment>`

---

### `Media.isRecording()`

Checks if currently recording.

```javascript
const recording = Media.isRecording();
```

**Returns:** `boolean`

---

### `Media.playAudio(dataUri)`

Plays audio from a data URI.

```javascript
Media.playAudio('data:audio/webm;base64,...');
```

**Parameters:**
- `dataUri` (string): Base64 audio data URI

**Returns:** `Promise<void>` - Resolves when playback completes

---

### `Media.stopAudio()`

Stops current audio playback.

```javascript
Media.stopAudio();
```

---

### `Media.validateFile(file, type)`

Validates a file for upload.

```javascript
const result = Media.validateFile(file, 'image');
// Returns: { valid: true } or { valid: false, error: 'message' }
```

**Parameters:**
- `file` (File): File to validate
- `type` ('image' | 'audio'): Expected file type

**Returns:** `object` - Validation result

---

## Export Module

**File:** `js/export.js`

Handles import and export of collections.

### `Export.exportCollection(collectionId)`

Exports a collection as a downloadable file.

```javascript
const blob = await Export.exportCollection('collection-uuid');
// Then trigger download:
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'collection-name.srep';
a.click();
```

**Parameters:**
- `collectionId` (string): Collection UUID

**Returns:** `Promise<Blob>` - The export file as a Blob

---

### `Export.importCollection(file)`

Imports a collection from a file.

```javascript
const result = await Export.importCollection(file);
// Returns: { collection, cardsImported }
```

**Parameters:**
- `file` (File): The .srep file to import

**Returns:** `Promise<object>` - Import result

**Throws:** `ImportError` if file is invalid

---

### `Export.validateImport(data)`

Validates import data without importing.

```javascript
const validation = Export.validateImport(parsedData);
// Returns: { valid: true } or { valid: false, errors: [...] }
```

**Parameters:**
- `data` (object): Parsed JSON data

**Returns:** `object` - Validation result

---

## App Module

**File:** `js/app.js`

Main application controller.

### `App.init()`

Initializes the application.

```javascript
await App.init();
```

**Returns:** `Promise<void>`

---

### `App.navigateTo(view, params?)`

Navigates to a view.

```javascript
App.navigateTo('study', { collectionId: 'uuid' });
```

**Parameters:**
- `view` ('collections' | 'study' | 'edit'): Target view
- `params` (object, optional): View parameters

---

### `App.showNotification(message, type?)`

Shows a notification to the user.

```javascript
App.showNotification('Card saved!', 'success');
```

**Parameters:**
- `message` (string): Notification text
- `type` ('info' | 'success' | 'warning' | 'error', optional): Notification type

---

### Events

The app emits events that can be listened to:

```javascript
App.on('collection:created', (collection) => {
  console.log('New collection:', collection.name);
});

App.on('card:reviewed', ({ card, quality }) => {
  console.log(`Reviewed card with quality ${quality}`);
});
```

**Available Events:**
- `collection:created` - New collection created
- `collection:updated` - Collection modified
- `collection:deleted` - Collection removed
- `card:created` - New card created
- `card:updated` - Card modified
- `card:deleted` - Card removed
- `card:reviewed` - Card review completed
- `study:started` - Study session began
- `study:completed` - Study session finished

---

## Error Types

### `StorageError`

Thrown when database operations fail.

```javascript
class StorageError extends Error {
  name = 'StorageError';
  operation: string;  // e.g., 'read', 'write', 'delete'
  store: string;      // e.g., 'collections', 'cards'
}
```

### `MediaError`

Thrown when media operations fail.

```javascript
class MediaError extends Error {
  name = 'MediaError';
  type: 'permission' | 'format' | 'size' | 'recording';
}
```

### `ImportError`

Thrown when import validation fails.

```javascript
class ImportError extends Error {
  name = 'ImportError';
  errors: string[];  // List of validation errors
}
```
