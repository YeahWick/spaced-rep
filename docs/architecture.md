# Architecture Overview

This document describes the architecture of the Spaced Repetition Learning Cards application.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Environment                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   index.html │  │  styles.css │  │      JavaScript         │  │
│  │   (UI Layer) │  │  (Styling)  │  │      Modules            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Application Layer                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │  app.js  │ │ media.js │ │export.js │ │sr-algorithm.js │  │ │
│  │  │  (Core)  │ │ (Media)  │ │(Import/  │ │(Spaced Rep)    │  │ │
│  │  │          │ │          │ │ Export)  │ │                │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Storage Layer                            │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │                    storage.js                         │   │ │
│  │  │              (IndexedDB Abstraction)                  │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                       IndexedDB                              │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │ │
│  │  │ collections│ │   cards    │ │  settings  │              │ │
│  │  │   store    │ │   store    │ │   store    │              │ │
│  │  └────────────┘ └────────────┘ └────────────┘              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### app.js - Core Application

The main application module orchestrates all components:

- **UI Management**: Handles DOM manipulation and event binding
- **State Management**: Maintains application state (current collection, current card, etc.)
- **Navigation**: Manages views (collection list, study mode, card editor)
- **Event Coordination**: Coordinates events between modules

```javascript
// Core state structure
const AppState = {
  currentView: 'collections' | 'study' | 'edit',
  currentCollection: CollectionId | null,
  currentCard: CardId | null,
  studySession: StudySession | null,
  settings: UserSettings
};
```

### storage.js - Data Persistence

Abstracts IndexedDB operations with a promise-based API:

- **Database Initialization**: Creates/upgrades database schema
- **CRUD Operations**: Create, read, update, delete for all entities
- **Transactions**: Handles transaction management
- **Error Handling**: Graceful error handling with fallbacks

```javascript
// Storage API
Storage.init()                           // Initialize database
Storage.collections.getAll()             // Get all collections
Storage.collections.get(id)              // Get collection by ID
Storage.collections.create(data)         // Create collection
Storage.collections.update(id, data)     // Update collection
Storage.collections.delete(id)           // Delete collection
Storage.cards.getByCollection(collId)    // Get cards in collection
Storage.cards.getDue(collId)             // Get cards due for review
// ... similar for cards and settings
```

### sr-algorithm.js - Spaced Repetition

Implements the SM-2 algorithm with modifications:

- **Interval Calculation**: Computes next review date based on performance
- **Ease Factor Management**: Adjusts difficulty based on recall quality
- **Queue Management**: Determines card order for studying

```javascript
// Algorithm interface
SRAlgorithm.calculateNextReview(card, quality)  // Returns updated card data
SRAlgorithm.getDueCards(cards, date)            // Filters cards due for review
SRAlgorithm.getNewCards(cards, limit)           // Gets new cards to introduce
SRAlgorithm.sortStudyQueue(cards)               // Sorts cards for optimal study
```

### media.js - Media Handling

Manages images and audio:

- **Image Processing**: Resize, compress, convert to base64
- **Audio Recording**: Web Audio API integration for recording
- **Audio Playback**: Handles audio playback controls
- **File Validation**: Validates file types and sizes

```javascript
// Media API
Media.processImage(file)      // Returns base64 data URI
Media.startRecording()        // Starts audio recording
Media.stopRecording()         // Stops and returns audio blob
Media.playAudio(dataUri)      // Plays audio from data URI
Media.validateFile(file)      // Validates file type/size
```

### export.js - Import/Export

Handles data portability:

- **Export**: Packages collection data into downloadable file
- **Import**: Parses and validates imported files
- **Migration**: Handles version differences in export format

```javascript
// Export API
Export.exportCollection(collectionId)   // Returns downloadable blob
Export.importCollection(file)           // Imports from file
Export.validateImport(data)             // Validates import data
```

## Data Flow

### Creating a Card

```
User Input → app.js → media.js (process media) → storage.js → IndexedDB
                                                      ↓
                                               Update UI State
```

### Studying a Card

```
Start Study → storage.js (get due cards) → sr-algorithm.js (sort queue)
                                                    ↓
                                            Display Card
                                                    ↓
User Rates → sr-algorithm.js (calculate next) → storage.js (save)
                                                    ↓
                                            Next Card / Complete
```

### Export Flow

```
Export Click → storage.js (get collection + cards) → export.js (package)
                                                          ↓
                                                   Download File
```

### Import Flow

```
File Select → export.js (validate) → storage.js (save collection + cards)
                                              ↓
                                       Update UI
```

## Event System

The application uses a custom event system for loose coupling:

```javascript
// Event types
'collection:created'    // New collection created
'collection:updated'    // Collection modified
'collection:deleted'    // Collection removed
'card:created'          // New card created
'card:updated'          // Card modified (including SR data)
'card:deleted'          // Card removed
'study:started'         // Study session began
'study:completed'       // Study session finished
'settings:changed'      // User settings modified
```

## Error Handling Strategy

1. **Storage Errors**: Caught and displayed to user with recovery options
2. **Media Errors**: Graceful degradation (e.g., skip audio if not supported)
3. **Import Errors**: Detailed validation messages
4. **UI Errors**: Error boundaries prevent full app crashes

## Security Considerations

- **No eval()**: All data is treated as data, never executed
- **Content Sanitization**: HTML content is sanitized before display
- **File Validation**: Strict validation of uploaded files
- **Storage Quotas**: Monitor and warn about storage limits
