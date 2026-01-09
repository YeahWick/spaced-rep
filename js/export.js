/**
 * Export Module
 * Handles import and export of collections
 */

const Export = (function() {
    const FORMAT_VERSION = '1.0';
    const APP_VERSION = '1.0.0';
    const FILE_EXTENSION = '.srep';

    /**
     * Export a collection as a downloadable file
     */
    async function exportCollection(collectionId) {
        try {
            // Get collection and cards
            const collection = await Storage.collections.get(collectionId);
            if (!collection) {
                throw new ExportError('Collection not found');
            }

            const cards = await Storage.cards.getByCollection(collectionId);

            // Build export data
            const exportData = {
                version: FORMAT_VERSION,
                exportDate: new Date().toISOString(),
                appVersion: APP_VERSION,
                collection: collection,
                cards: cards,
                checksum: '' // Will be calculated
            };

            // Calculate checksum
            exportData.checksum = await calculateChecksum(JSON.stringify({
                collection: exportData.collection,
                cards: exportData.cards
            }));

            // Create blob
            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });

            return {
                blob,
                filename: sanitizeFilename(collection.name) + FILE_EXTENSION
            };
        } catch (error) {
            if (error instanceof ExportError) throw error;
            throw new ExportError('Failed to export collection: ' + error.message);
        }
    }

    /**
     * Import a collection from a file
     */
    async function importCollection(file) {
        try {
            // Read file
            const text = await readFile(file);

            // Parse JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new ImportError('Invalid file format. File is not valid JSON.', ['Parse error']);
            }

            // Validate
            const validation = validateImport(data);
            if (!validation.valid) {
                throw new ImportError('Invalid import file', validation.errors);
            }

            // Verify checksum if present
            if (data.checksum) {
                const calculatedChecksum = await calculateChecksum(JSON.stringify({
                    collection: data.collection,
                    cards: data.cards
                }));

                if (calculatedChecksum !== data.checksum) {
                    console.warn('Checksum mismatch - file may have been modified');
                }
            }

            // Create new collection with new ID
            const newCollection = await Storage.collections.create({
                name: data.collection.name,
                description: data.collection.description,
                color: data.collection.color,
                settings: data.collection.settings
            });

            // Import cards with new IDs
            let cardsImported = 0;
            for (const card of data.cards) {
                await Storage.cards.create({
                    collectionId: newCollection.id,
                    front: card.front,
                    back: card.back,
                    tags: card.tags
                    // Note: SR data is reset for imported cards
                });
                cardsImported++;
            }

            // Update stats
            await Storage.collections.updateStats(newCollection.id);

            return {
                collection: newCollection,
                cardsImported
            };
        } catch (error) {
            if (error instanceof ImportError) throw error;
            throw new ImportError('Failed to import: ' + error.message, [error.message]);
        }
    }

    /**
     * Import collection preserving SR data (for backup restore)
     */
    async function importCollectionWithProgress(file) {
        try {
            const text = await readFile(file);
            const data = JSON.parse(text);

            const validation = validateImport(data);
            if (!validation.valid) {
                throw new ImportError('Invalid import file', validation.errors);
            }

            // Create new collection with new ID
            const newCollection = await Storage.collections.create({
                name: data.collection.name + ' (Restored)',
                description: data.collection.description,
                color: data.collection.color,
                settings: data.collection.settings
            });

            // Import cards preserving SR data
            let cardsImported = 0;
            for (const card of data.cards) {
                const newCard = await Storage.cards.create({
                    collectionId: newCollection.id,
                    front: card.front,
                    back: card.back,
                    tags: card.tags
                });

                // Update with preserved SR data
                if (card.sr) {
                    await Storage.cards.update(newCard.id, {
                        sr: {
                            ...card.sr,
                            history: card.sr.history || []
                        }
                    });
                }
                cardsImported++;
            }

            await Storage.collections.updateStats(newCollection.id);

            return {
                collection: newCollection,
                cardsImported
            };
        } catch (error) {
            if (error instanceof ImportError) throw error;
            throw new ImportError('Failed to import: ' + error.message, [error.message]);
        }
    }

    /**
     * Validate import data structure
     */
    function validateImport(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Invalid data format'] };
        }

        // Check version
        if (!data.version) {
            errors.push('Missing version field');
        }

        // Check collection
        if (!data.collection) {
            errors.push('Missing collection data');
        } else {
            if (!data.collection.name || typeof data.collection.name !== 'string') {
                errors.push('Collection must have a name');
            }
            if (data.collection.name && data.collection.name.length > 100) {
                errors.push('Collection name too long (max 100 characters)');
            }
        }

        // Check cards
        if (!Array.isArray(data.cards)) {
            errors.push('Cards must be an array');
        } else {
            data.cards.forEach((card, index) => {
                if (!card.front || typeof card.front.text !== 'string') {
                    errors.push(`Card ${index + 1}: Missing front text`);
                }
                if (!card.back || typeof card.back.text !== 'string') {
                    errors.push(`Card ${index + 1}: Missing back text`);
                }
            });

            // Limit check
            if (data.cards.length > 10000) {
                errors.push('Too many cards (max 10,000 per import)');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Read file as text
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Calculate SHA-256 checksum
     */
    async function calculateChecksum(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return 'sha256:' + hashHex;
    }

    /**
     * Sanitize filename
     */
    function sanitizeFilename(name) {
        return name
            .replace(/[^a-z0-9\s-]/gi, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 50) || 'collection';
    }

    /**
     * Trigger file download
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export all collections (full backup)
     */
    async function exportAllCollections() {
        const collections = await Storage.collections.getAll();
        const allData = {
            version: FORMAT_VERSION,
            exportDate: new Date().toISOString(),
            appVersion: APP_VERSION,
            type: 'full-backup',
            collections: []
        };

        for (const collection of collections) {
            const cards = await Storage.cards.getByCollection(collection.id);
            allData.collections.push({
                collection,
                cards
            });
        }

        const json = JSON.stringify(allData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        return {
            blob,
            filename: `spacerep-backup-${new Date().toISOString().split('T')[0]}${FILE_EXTENSION}`
        };
    }

    // Custom error classes
    class ExportError extends Error {
        constructor(message) {
            super(message);
            this.name = 'ExportError';
        }
    }

    class ImportError extends Error {
        constructor(message, errors = []) {
            super(message);
            this.name = 'ImportError';
            this.errors = errors;
        }
    }

    return {
        exportCollection,
        importCollection,
        importCollectionWithProgress,
        validateImport,
        downloadBlob,
        exportAllCollections,
        ExportError,
        ImportError
    };
})();
