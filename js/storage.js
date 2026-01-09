/**
 * Storage Module
 * Handles all IndexedDB operations with a promise-based API
 */

const Storage = (function() {
    const DB_NAME = 'SpacedRepDB';
    const DB_VERSION = 1;
    let db = null;

    /**
     * Initialize the database
     */
    async function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new StorageError('Failed to open database', 'open', 'database'));
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // Collections store
                if (!database.objectStoreNames.contains('collections')) {
                    const collectionsStore = database.createObjectStore('collections', { keyPath: 'id' });
                    collectionsStore.createIndex('name', 'name', { unique: false });
                    collectionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // Cards store
                if (!database.objectStoreNames.contains('cards')) {
                    const cardsStore = database.createObjectStore('cards', { keyPath: 'id' });
                    cardsStore.createIndex('collectionId', 'collectionId', { unique: false });
                    cardsStore.createIndex('dueDate', 'sr.dueDate', { unique: false });
                    cardsStore.createIndex('state', 'sr.state', { unique: false });
                }

                // Settings store
                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Generate a UUID v4
     */
    function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get current ISO timestamp
     */
    function timestamp() {
        return new Date().toISOString();
    }

    /**
     * Get today's date string (YYYY-MM-DD)
     */
    function todayString() {
        return new Date().toISOString().split('T')[0];
    }

    // Collections API
    const collections = {
        async getAll() {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['collections'], 'readonly');
                const store = transaction.objectStore('collections');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new StorageError('Failed to get collections', 'read', 'collections'));
            });
        },

        async get(id) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['collections'], 'readonly');
                const store = transaction.objectStore('collections');
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(new StorageError('Failed to get collection', 'read', 'collections'));
            });
        },

        async create(data) {
            const collection = {
                id: generateId(),
                name: data.name,
                description: data.description || '',
                createdAt: timestamp(),
                updatedAt: timestamp(),
                color: data.color || null,
                settings: {
                    newCardsPerDay: data.settings?.newCardsPerDay || 20,
                    reviewsPerDay: data.settings?.reviewsPerDay || 200,
                    learningSteps: data.settings?.learningSteps || [1, 10],
                    graduatingInterval: data.settings?.graduatingInterval || 1,
                    easyInterval: data.settings?.easyInterval || 4,
                    startingEase: data.settings?.startingEase || 2.5
                },
                stats: {
                    totalCards: 0,
                    newCards: 0,
                    learningCards: 0,
                    reviewCards: 0,
                    dueToday: 0,
                    averageEase: 2.5,
                    lastStudied: null
                }
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['collections'], 'readwrite');
                const store = transaction.objectStore('collections');
                const request = store.add(collection);

                request.onsuccess = () => resolve(collection);
                request.onerror = () => reject(new StorageError('Failed to create collection', 'write', 'collections'));
            });
        },

        async update(id, data) {
            const existing = await this.get(id);
            if (!existing) {
                throw new StorageError('Collection not found', 'update', 'collections');
            }

            const updated = {
                ...existing,
                ...data,
                id: existing.id, // Prevent ID change
                createdAt: existing.createdAt, // Prevent creation date change
                updatedAt: timestamp()
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['collections'], 'readwrite');
                const store = transaction.objectStore('collections');
                const request = store.put(updated);

                request.onsuccess = () => resolve(updated);
                request.onerror = () => reject(new StorageError('Failed to update collection', 'update', 'collections'));
            });
        },

        async delete(id) {
            // First delete all cards in the collection
            const cardsToDelete = await cards.getByCollection(id);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['collections', 'cards'], 'readwrite');
                const collectionsStore = transaction.objectStore('collections');
                const cardsStore = transaction.objectStore('cards');

                // Delete all cards
                cardsToDelete.forEach(card => {
                    cardsStore.delete(card.id);
                });

                // Delete collection
                const request = collectionsStore.delete(id);

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(new StorageError('Failed to delete collection', 'delete', 'collections'));
            });
        },

        async updateStats(id) {
            const allCards = await cards.getByCollection(id);
            const today = todayString();

            let newCards = 0;
            let learningCards = 0;
            let reviewCards = 0;
            let dueToday = 0;
            let totalEase = 0;

            allCards.forEach(card => {
                if (card.sr.state === 'new') newCards++;
                else if (card.sr.state === 'learning') learningCards++;
                else if (card.sr.state === 'review') reviewCards++;

                if (card.sr.dueDate && card.sr.dueDate <= today) {
                    dueToday++;
                }

                totalEase += card.sr.easeFactor;
            });

            const stats = {
                totalCards: allCards.length,
                newCards,
                learningCards,
                reviewCards,
                dueToday: dueToday + newCards, // New cards are always "due"
                averageEase: allCards.length > 0 ? totalEase / allCards.length : 2.5
            };

            await this.update(id, { stats });
            return stats;
        }
    };

    // Cards API
    const cards = {
        async getByCollection(collectionId) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cards'], 'readonly');
                const store = transaction.objectStore('cards');
                const index = store.index('collectionId');
                const request = index.getAll(collectionId);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new StorageError('Failed to get cards', 'read', 'cards'));
            });
        },

        async get(id) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cards'], 'readonly');
                const store = transaction.objectStore('cards');
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(new StorageError('Failed to get card', 'read', 'cards'));
            });
        },

        async create(data) {
            const card = {
                id: generateId(),
                collectionId: data.collectionId,
                front: {
                    text: data.front?.text || '',
                    html: data.front?.html || null,
                    images: data.front?.images || [],
                    audio: data.front?.audio || []
                },
                back: {
                    text: data.back?.text || '',
                    html: data.back?.html || null,
                    images: data.back?.images || [],
                    audio: data.back?.audio || []
                },
                tags: data.tags || [],
                createdAt: timestamp(),
                updatedAt: timestamp(),
                sr: {
                    state: 'new',
                    interval: 0,
                    easeFactor: 2.5,
                    repetitions: 0,
                    dueDate: null,
                    lastReview: null,
                    learningStep: 0,
                    history: []
                }
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cards'], 'readwrite');
                const store = transaction.objectStore('cards');
                const request = store.add(card);

                request.onsuccess = async () => {
                    // Update collection stats
                    await collections.updateStats(data.collectionId);
                    resolve(card);
                };
                request.onerror = () => reject(new StorageError('Failed to create card', 'write', 'cards'));
            });
        },

        async update(id, data) {
            const existing = await this.get(id);
            if (!existing) {
                throw new StorageError('Card not found', 'update', 'cards');
            }

            const updated = {
                ...existing,
                ...data,
                id: existing.id,
                collectionId: existing.collectionId,
                createdAt: existing.createdAt,
                updatedAt: timestamp()
            };

            // Deep merge for nested objects
            if (data.front) {
                updated.front = { ...existing.front, ...data.front };
            }
            if (data.back) {
                updated.back = { ...existing.back, ...data.back };
            }
            if (data.sr) {
                updated.sr = { ...existing.sr, ...data.sr };
            }

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cards'], 'readwrite');
                const store = transaction.objectStore('cards');
                const request = store.put(updated);

                request.onsuccess = async () => {
                    // Update collection stats
                    await collections.updateStats(existing.collectionId);
                    resolve(updated);
                };
                request.onerror = () => reject(new StorageError('Failed to update card', 'update', 'cards'));
            });
        },

        async delete(id) {
            const card = await this.get(id);
            if (!card) {
                throw new StorageError('Card not found', 'delete', 'cards');
            }

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cards'], 'readwrite');
                const store = transaction.objectStore('cards');
                const request = store.delete(id);

                request.onsuccess = async () => {
                    // Update collection stats
                    await collections.updateStats(card.collectionId);
                    resolve();
                };
                request.onerror = () => reject(new StorageError('Failed to delete card', 'delete', 'cards'));
            });
        },

        async getDue(collectionId, date = new Date()) {
            const allCards = await this.getByCollection(collectionId);
            const dateString = date.toISOString().split('T')[0];

            return allCards.filter(card => {
                if (card.sr.state === 'new') return true;
                if (card.sr.state === 'learning') return true;
                if (card.sr.dueDate && card.sr.dueDate <= dateString) return true;
                return false;
            });
        },

        async bulkCreate(cardsData) {
            const results = [];
            for (const data of cardsData) {
                const card = await this.create(data);
                results.push(card);
            }
            return results;
        }
    };

    // Settings API
    const settings = {
        async get(key) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['settings'], 'readonly');
                const store = transaction.objectStore('settings');
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : undefined);
                };
                request.onerror = () => reject(new StorageError('Failed to get setting', 'read', 'settings'));
            });
        },

        async set(key, value) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                const request = store.put({ key, value });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new StorageError('Failed to set setting', 'write', 'settings'));
            });
        },

        async getAll() {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['settings'], 'readonly');
                const store = transaction.objectStore('settings');
                const request = store.getAll();

                request.onsuccess = () => {
                    const result = {};
                    request.result.forEach(item => {
                        result[item.key] = item.value;
                    });
                    resolve(result);
                };
                request.onerror = () => reject(new StorageError('Failed to get settings', 'read', 'settings'));
            });
        }
    };

    // Custom error class
    class StorageError extends Error {
        constructor(message, operation, store) {
            super(message);
            this.name = 'StorageError';
            this.operation = operation;
            this.store = store;
        }
    }

    return {
        init,
        collections,
        cards,
        settings,
        StorageError,
        generateId
    };
})();
