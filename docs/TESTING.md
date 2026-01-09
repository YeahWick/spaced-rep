# Testing Plan

This document outlines the testing strategy for the Spaced Repetition Learning Cards application.

## Overview

The application is a vanilla JavaScript web app with no build process. Testing will focus on:
- **Unit tests** for individual modules and functions
- **Integration tests** for module interactions
- **End-to-end tests** for critical user workflows

## Recommended Testing Stack

### Primary Tools

| Tool | Purpose | Why |
|------|---------|-----|
| **Jest** | Unit & integration testing | Industry standard, excellent mocking, JSDOM support |
| **jest-environment-jsdom** | DOM simulation | Provides browser-like environment |
| **fake-indexeddb** | IndexedDB mocking | Full IndexedDB implementation for Node.js |
| **Playwright** | E2E testing | Modern, reliable, multi-browser support |

### Installation

```bash
# Initialize npm (if not already done)
npm init -y

# Install test dependencies
npm install --save-dev jest jest-environment-jsdom fake-indexeddb

# Install E2E testing
npm install --save-dev @playwright/test
npx playwright install
```

### Configuration

**jest.config.js**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

**package.json scripts**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test"
  }
}
```

## Test Structure

```
tests/
├── setup.js                    # Global test setup
├── unit/
│   ├── storage.test.js         # Storage module tests
│   ├── sr-algorithm.test.js    # Algorithm tests
│   ├── media.test.js           # Media handling tests
│   └── export.test.js          # Import/export tests
├── integration/
│   ├── app-storage.test.js     # App + Storage integration
│   ├── study-flow.test.js      # Study session flow
│   └── collection-crud.test.js # Collection operations
└── e2e/
    ├── create-collection.spec.js
    ├── study-session.spec.js
    └── import-export.spec.js
```

## Module Testing Strategy

### 1. Storage Module (`storage.js`)

**Priority: High** - Foundation for all data operations

| Test Case | Type | Description |
|-----------|------|-------------|
| `initDB()` | Unit | Database initialization creates all object stores |
| `saveCollection()` | Unit | Collections are persisted correctly |
| `getCollection()` | Unit | Retrieved data matches saved data |
| `deleteCollection()` | Unit | Deletion removes collection and associated cards |
| `saveCard()` | Unit | Cards are saved with correct collectionId |
| `getCardsByCollection()` | Unit | Filtering by collection works correctly |
| `updateCard()` | Unit | Partial updates preserve other fields |
| `getSettings()` / `saveSettings()` | Unit | Settings persistence |
| Concurrent operations | Integration | Multiple simultaneous writes don't corrupt data |

**Mocking Strategy:**
```javascript
// tests/setup.js
import 'fake-indexeddb/auto';

// This provides a full IndexedDB implementation in Node.js
// No additional mocking needed for storage tests
```

### 2. SR Algorithm Module (`sr-algorithm.js`)

**Priority: High** - Core business logic

| Test Case | Type | Description |
|-----------|------|-------------|
| `calculateNextReview()` quality=0 | Unit | Card resets on "Again" response |
| `calculateNextReview()` quality=1 | Unit | "Hard" extends interval minimally |
| `calculateNextReview()` quality=2 | Unit | "Good" uses standard progression |
| `calculateNextReview()` quality=3 | Unit | "Easy" maximizes interval growth |
| New card initialization | Unit | First review sets correct initial values |
| Ease factor bounds | Unit | EF never drops below 1.3 |
| Interval calculation | Unit | Intervals follow SM-2 formula |
| `getStudyQueue()` | Unit | Returns cards due for review |
| Queue ordering | Unit | Overdue cards prioritized correctly |
| `updateCardAfterReview()` | Integration | Card state updated in storage |

**Example Test:**
```javascript
describe('SR Algorithm', () => {
  describe('calculateNextReview', () => {
    it('should reset card on quality 0 (Again)', () => {
      const card = {
        repetitions: 5,
        easeFactor: 2.5,
        interval: 30
      };

      const result = SRAlgorithm.calculateNextReview(card, 0);

      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBeLessThan(card.easeFactor);
    });

    it('should increase interval on quality 3 (Easy)', () => {
      const card = {
        repetitions: 2,
        easeFactor: 2.5,
        interval: 6
      };

      const result = SRAlgorithm.calculateNextReview(card, 3);

      expect(result.interval).toBeGreaterThan(card.interval);
      expect(result.easeFactor).toBeGreaterThan(card.easeFactor);
    });
  });
});
```

### 3. Media Module (`media.js`)

**Priority: Medium** - Complex browser API interactions

| Test Case | Type | Description |
|-----------|------|-------------|
| `validateImage()` | Unit | Accepts valid image types |
| `validateImage()` | Unit | Rejects invalid types |
| `validateImage()` | Unit | Enforces size limits |
| `compressImage()` | Unit | Output smaller than input |
| `resizeImage()` | Unit | Respects max dimensions |
| Audio recording start/stop | Integration | MediaRecorder lifecycle |
| `processAudioBlob()` | Unit | Converts blob to base64 |
| File type detection | Unit | Correct MIME type identification |

**Mocking Strategy:**
```javascript
// Mock canvas for image operations
const mockCanvas = {
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    getImageData: jest.fn()
  })),
  toBlob: jest.fn((callback) => callback(new Blob(['test']))),
  toDataURL: jest.fn(() => 'data:image/jpeg;base64,test')
};
document.createElement = jest.fn((tag) => {
  if (tag === 'canvas') return mockCanvas;
  return document.createElement.call(document, tag);
});

// Mock MediaRecorder for audio tests
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null
}));
```

### 4. Export Module (`export.js`)

**Priority: Medium** - Data integrity critical

| Test Case | Type | Description |
|-----------|------|-------------|
| `exportCollection()` | Unit | Generates valid .srep format |
| `exportCollection()` | Unit | Includes all cards for collection |
| `importCollection()` | Unit | Parses valid .srep files |
| `importCollection()` | Unit | Rejects invalid format |
| `importCollection()` | Unit | Handles missing fields gracefully |
| Version compatibility | Unit | Imports from older versions |
| ID regeneration | Unit | Imported items get new IDs |
| Large file handling | Unit | Handles collections with many cards |

**Example Test:**
```javascript
describe('Export Module', () => {
  describe('importCollection', () => {
    it('should reject invalid file format', async () => {
      const invalidData = 'not valid json';

      await expect(
        ExportModule.importCollection(invalidData)
      ).rejects.toThrow('Invalid file format');
    });

    it('should regenerate IDs on import', async () => {
      const validExport = {
        version: '1.0',
        collection: { id: 'old-id', name: 'Test' },
        cards: [{ id: 'card-old-id', front: 'Q', back: 'A' }]
      };

      const result = await ExportModule.importCollection(
        JSON.stringify(validExport)
      );

      expect(result.collection.id).not.toBe('old-id');
      expect(result.cards[0].id).not.toBe('card-old-id');
    });
  });
});
```

### 5. App Module (`app.js`)

**Priority: High** - Core user experience

| Test Case | Type | Description |
|-----------|------|-------------|
| `init()` | Integration | App initializes without errors |
| `showView()` | Unit | View switching updates DOM correctly |
| `renderCollections()` | Unit | Collections display in list |
| `handleAddCard()` | Integration | New card saved to storage |
| `startStudySession()` | Integration | Queue populated correctly |
| `handleAnswer()` | Integration | Card updated after rating |
| Keyboard shortcuts | Unit | Correct actions triggered |
| Navigation state | Unit | Browser back/forward works |
| Error handling | Unit | Errors displayed to user |

**DOM Testing Example:**
```javascript
describe('App Module', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="collections-view" class="view"></div>
        <div id="study-view" class="view hidden"></div>
      </div>
    `;
  });

  describe('showView', () => {
    it('should show requested view and hide others', () => {
      App.showView('study');

      expect(
        document.getElementById('study-view').classList.contains('hidden')
      ).toBe(false);
      expect(
        document.getElementById('collections-view').classList.contains('hidden')
      ).toBe(true);
    });
  });
});
```

## Integration Test Scenarios

### Study Flow Integration

```javascript
describe('Study Flow', () => {
  it('should complete a full study session', async () => {
    // Setup: Create collection with cards
    const collection = await Storage.saveCollection({ name: 'Test' });
    await Storage.saveCard({
      collectionId: collection.id,
      front: 'Question',
      back: 'Answer',
      nextReview: new Date(Date.now() - 86400000) // Due yesterday
    });

    // Start study session
    await App.startStudySession(collection.id);
    expect(App.getCurrentCard()).toBeDefined();

    // Show answer
    App.showAnswer();
    expect(document.getElementById('answer').classList.contains('hidden')).toBe(false);

    // Rate card
    await App.handleAnswer(2); // Good

    // Verify card updated
    const updatedCard = await Storage.getCard(card.id);
    expect(updatedCard.repetitions).toBe(1);
    expect(new Date(updatedCard.nextReview)).toBeGreaterThan(new Date());
  });
});
```

## End-to-End Tests

### E2E Test Configuration

**playwright.config.js**
```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npx serve .',
    port: 3000
  }
});
```

### Critical E2E Scenarios

1. **Create and Study Collection**
   - Create new collection
   - Add multiple cards with text
   - Start study session
   - Rate all cards
   - Verify progress updated

2. **Import/Export Workflow**
   - Create collection with cards
   - Export to file
   - Delete collection
   - Import from file
   - Verify data restored

3. **Media Card Creation**
   - Create collection
   - Add card with image
   - Add card with audio
   - Study cards with media
   - Verify media displays correctly

**Example E2E Test:**
```javascript
// tests/e2e/create-collection.spec.js
import { test, expect } from '@playwright/test';

test('create collection and add cards', async ({ page }) => {
  await page.goto('/');

  // Create collection
  await page.click('[data-action="new-collection"]');
  await page.fill('#collection-name', 'JavaScript Basics');
  await page.click('#save-collection');

  // Verify collection appears
  await expect(page.locator('.collection-item')).toContainText('JavaScript Basics');

  // Add card
  await page.click('.collection-item');
  await page.click('[data-action="add-card"]');
  await page.fill('#card-front', 'What is a closure?');
  await page.fill('#card-back', 'A function with access to its outer scope');
  await page.click('#save-card');

  // Verify card count
  await expect(page.locator('.card-count')).toContainText('1 card');
});
```

## Test Data Fixtures

**tests/fixtures/collections.js**
```javascript
export const sampleCollection = {
  id: 'test-collection-1',
  name: 'Sample Collection',
  description: 'For testing',
  createdAt: '2024-01-01T00:00:00Z',
  cardCount: 0,
  dueCount: 0
};

export const sampleCards = [
  {
    id: 'card-1',
    collectionId: 'test-collection-1',
    front: 'Question 1',
    back: 'Answer 1',
    repetitions: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReview: new Date().toISOString()
  },
  {
    id: 'card-2',
    collectionId: 'test-collection-1',
    front: 'Question 2',
    back: 'Answer 2',
    repetitions: 3,
    easeFactor: 2.6,
    interval: 15,
    nextReview: new Date(Date.now() + 86400000 * 15).toISOString()
  }
];

export const sampleExport = {
  version: '1.0',
  exportedAt: '2024-01-01T00:00:00Z',
  collection: sampleCollection,
  cards: sampleCards
};
```

## Coverage Goals

| Module | Target Coverage | Rationale |
|--------|-----------------|-----------|
| storage.js | 90% | Critical data layer |
| sr-algorithm.js | 95% | Core business logic |
| media.js | 70% | Heavy browser API mocking needed |
| export.js | 85% | Data integrity important |
| app.js | 75% | UI logic harder to test |
| **Overall** | **80%** | Balanced coverage |

## Running Tests

```bash
# Run all unit/integration tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode during development
npm run test:watch

# Run specific test file
npm test -- tests/unit/sr-algorithm.test.js

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npx playwright test --ui
```

## CI/CD Integration

**GitHub Actions Workflow (.github/workflows/test.yml)**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Implementation Roadmap

### Phase 1: Foundation
1. Set up npm and install dependencies
2. Create Jest configuration
3. Create test setup file with IndexedDB mock
4. Write tests for `sr-algorithm.js` (highest value, easiest to test)

### Phase 2: Storage & Export
1. Write tests for `storage.js`
2. Write tests for `export.js`
3. Create integration tests for storage operations

### Phase 3: Media & App
1. Write tests for `media.js` with browser API mocks
2. Write tests for `app.js` UI logic
3. Create integration tests for user workflows

### Phase 4: E2E & CI
1. Set up Playwright
2. Write critical path E2E tests
3. Configure GitHub Actions workflow
4. Add coverage badges to README

## Notes

- **Module Adaptation**: The current IIFE pattern may need minor refactoring to export functions for testing. Consider using ES modules with a simple build step, or exposing modules on `window` for test access.
- **Browser API Mocks**: Some tests will require mocking `MediaRecorder`, `Canvas`, and `FileReader`. These are well-supported by Jest's mocking capabilities.
- **Test Isolation**: Each test should start with a fresh IndexedDB state. Use `beforeEach` to clear all data.
