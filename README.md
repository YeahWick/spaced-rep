# Spaced Repetition Learning Cards

A local-only, browser-based spaced repetition flashcard application. Create, study, and manage flashcards with text, audio, and images - all stored securely in your browser.

## Features

- **Local Storage**: All data stays in your browser using IndexedDB - no server required
- **Rich Media Support**: Create cards with text, images, and audio recordings
- **Spaced Repetition Algorithm**: SM-2 based algorithm optimizes your learning schedule
- **Import/Export**: Backup your collections or share them across devices
- **Multiple Collections**: Organize cards into separate decks
- **Progress Tracking**: Track your learning progress and review statistics
- **Offline Ready**: Works entirely offline after initial load

## Quick Start

1. Open `index.html` in a modern web browser
2. Create a new collection or import an existing one
3. Add cards with your content (text, images, audio)
4. Start studying!

## Usage

### Creating Cards

1. Click **"New Card"** button
2. Enter the **front** (question/prompt) content
3. Enter the **back** (answer) content
4. Optionally add:
   - **Images**: Click the image icon to upload or paste images
   - **Audio**: Click the microphone icon to record audio or upload audio files
5. Click **"Save Card"**

### Studying Cards

1. Select a collection to study
2. Cards due for review will be presented
3. View the front of the card and try to recall the answer
4. Click **"Show Answer"** to reveal the back
5. Rate your recall:
   - **Again** (0): Complete blackout, will review again soon
   - **Hard** (1): Significant difficulty recalling
   - **Good** (2): Correct with some effort
   - **Easy** (3): Perfect recall with no hesitation

### Managing Collections

- **Create**: Click "New Collection" and enter a name
- **Rename**: Right-click collection → Rename
- **Delete**: Right-click collection → Delete (with confirmation)
- **Export**: Click export icon to download as `.srep` file
- **Import**: Click "Import" and select a `.srep` file

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Show answer / Next card |
| `1` | Rate: Again |
| `2` | Rate: Hard |
| `3` | Rate: Good |
| `4` | Rate: Easy |
| `N` | New card |
| `E` | Edit current card |
| `Ctrl+S` | Save card (in edit mode) |

## Data Storage

All data is stored locally using IndexedDB:

- **Cards**: Question/answer content, media attachments
- **Collections**: Groups of related cards
- **Progress**: Review history, scheduling data
- **Settings**: User preferences

### Storage Limits

Browser storage limits vary but typically allow several hundred MB to several GB of data. The app will warn you if storage is running low.

## Export Format

Collections export as `.srep` files (JSON-based) containing:

```json
{
  "version": "1.0",
  "exportDate": "ISO-8601 timestamp",
  "collection": {
    "name": "Collection Name",
    "cards": [...]
  }
}
```

Media files are embedded as base64 data URIs for portability.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+

Requires support for:
- IndexedDB
- Web Audio API
- FileReader API
- Blob/File API

## Privacy

- **No tracking**: Zero analytics or telemetry
- **No network requests**: Everything runs locally
- **No accounts**: No registration required
- **Your data stays yours**: Never leaves your browser

## Documentation

See the [docs/](./docs/) folder for detailed documentation:

- [Architecture Overview](./docs/architecture.md)
- [Spaced Repetition Algorithm](./docs/algorithm.md)
- [Data Schema](./docs/data-schema.md)
- [API Reference](./docs/api-reference.md)

## Development

This is a vanilla HTML/CSS/JavaScript application with no build process required.

```
spaced-rep/
├── index.html          # Main application
├── css/
│   └── styles.css      # Application styles
├── js/
│   ├── app.js          # Main application logic
│   ├── storage.js      # IndexedDB operations
│   ├── sr-algorithm.js # Spaced repetition algorithm
│   ├── media.js        # Audio/image handling
│   └── export.js       # Import/export functionality
└── docs/               # Documentation
```

## License

MIT License - See LICENSE file for details.
