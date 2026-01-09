/**
 * Main Application Module
 * Orchestrates all components and handles UI
 */

const App = (function() {
    // Application state
    const state = {
        currentView: 'collections',
        currentCollection: null,
        currentCard: null,
        studySession: null,
        editingCard: null,
        cardMedia: {
            front: { images: [], audio: [] },
            back: { images: [], audio: [] }
        },
        settings: {
            theme: 'system',
            defaultNewCardsPerDay: 20,
            defaultReviewsPerDay: 200,
            autoPlayAudio: false,
            keyboardShortcuts: true
        }
    };

    // Event listeners map
    const eventListeners = {};

    /**
     * Initialize the application
     */
    async function init() {
        try {
            // Initialize storage
            await Storage.init();

            // Load settings
            await loadSettings();

            // Apply theme
            applyTheme(state.settings.theme);

            // Set up event listeners
            setupEventListeners();

            // Load initial view
            await loadCollections();

            // Show collections view
            navigateTo('collections');

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            showNotification('Failed to initialize application. Please refresh.', 'error');
        }
    }

    /**
     * Load user settings
     */
    async function loadSettings() {
        const savedSettings = await Storage.settings.getAll();
        Object.assign(state.settings, savedSettings);

        // Update UI
        document.getElementById('setting-theme').value = state.settings.theme || 'system';
        document.getElementById('setting-new-cards').value = state.settings.defaultNewCardsPerDay || 20;
        document.getElementById('setting-reviews').value = state.settings.defaultReviewsPerDay || 200;
        document.getElementById('setting-auto-play').checked = state.settings.autoPlayAudio || false;
        document.getElementById('setting-shortcuts').checked = state.settings.keyboardShortcuts !== false;
    }

    /**
     * Update a setting
     */
    async function updateSetting(key, value) {
        state.settings[key] = value;
        await Storage.settings.set(key, value);

        if (key === 'theme') {
            applyTheme(value);
        }

        emit('settings:changed', { key, value });
    }

    /**
     * Apply theme
     */
    function applyTheme(theme) {
        if (theme === 'system') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Navigation
        document.getElementById('back-btn').addEventListener('click', goBack);
        document.getElementById('settings-btn').addEventListener('click', showSettings);

        // Collections
        document.getElementById('new-collection-btn').addEventListener('click', showNewCollectionModal);
        document.getElementById('import-btn').addEventListener('click', triggerImport);

        // Import file input
        document.getElementById('import-file').addEventListener('change', handleImport);

        // Card form
        document.getElementById('card-form').addEventListener('submit', saveCard);

        // Study actions
        document.getElementById('show-answer-btn').addEventListener('click', showAnswer);

        // Rating buttons
        document.querySelectorAll('.btn-rating').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = parseInt(btn.dataset.quality);
                rateCard(quality);
            });
        });

        // Search
        document.getElementById('search-cards').addEventListener('input', debounce(searchCards, 300));

        // Modal overlay click to close
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboard(e) {
        if (!state.settings.keyboardShortcuts) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const view = state.currentView;

        if (view === 'study') {
            if (e.code === 'Space') {
                e.preventDefault();
                if (document.getElementById('show-answer-btn').style.display !== 'none') {
                    showAnswer();
                }
            } else if (e.key >= '1' && e.key <= '4') {
                const quality = parseInt(e.key) - 1;
                if (document.getElementById('rating-buttons').style.display !== 'none') {
                    rateCard(quality);
                }
            }
        }

        // Global shortcuts
        if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
            if (view === 'browse') {
                showCardEditor();
            }
        }

        if (e.key === 'Escape') {
            closeModal();
        }
    }

    /**
     * Navigate to a view
     */
    function navigateTo(view, params = {}) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show target view
        document.getElementById(`${view}-view`).classList.add('active');

        // Update back button visibility
        const backBtn = document.getElementById('back-btn');
        backBtn.style.display = view === 'collections' ? 'none' : 'block';

        // Update state
        state.currentView = view;

        // View-specific setup
        if (view === 'study' && params.collectionId) {
            startStudySession(params.collectionId);
        } else if (view === 'browse' && params.collectionId) {
            loadBrowseView(params.collectionId);
        } else if (view === 'editor' && params.cardId) {
            loadCardEditor(params.cardId);
        }

        emit('view:changed', { view, params });
    }

    /**
     * Go back to previous view
     */
    function goBack() {
        if (state.currentView === 'study' || state.currentView === 'browse') {
            navigateTo('collections');
        } else if (state.currentView === 'editor') {
            if (state.currentCollection) {
                navigateTo('browse', { collectionId: state.currentCollection });
            } else {
                navigateTo('collections');
            }
        }
    }

    /**
     * Load and display collections
     */
    async function loadCollections() {
        const collections = await Storage.collections.getAll();
        const container = document.getElementById('collections-list');
        const emptyState = document.getElementById('empty-collections');

        if (collections.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        // Update stats for all collections
        for (const collection of collections) {
            await Storage.collections.updateStats(collection.id);
        }

        // Reload with updated stats
        const updatedCollections = await Storage.collections.getAll();

        container.innerHTML = updatedCollections.map(collection => `
            <div class="collection-card" data-id="${collection.id}" onclick="App.openCollection('${collection.id}')">
                <div class="collection-card-header">
                    <div>
                        <div class="collection-card-title">${escapeHtml(collection.name)}</div>
                        ${collection.description ? `<div class="collection-card-desc">${escapeHtml(collection.description)}</div>` : ''}
                    </div>
                    <button class="btn btn-icon btn-small collection-more-btn" onclick="event.stopPropagation(); App.showCollectionOptions('${collection.id}')">
                        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                </div>
                <div class="collection-card-stats">
                    <div class="collection-stat">
                        <span class="collection-stat-value">${collection.stats?.dueToday || 0}</span>
                        <span class="collection-stat-label">Due</span>
                    </div>
                    <div class="collection-stat">
                        <span class="collection-stat-value">${collection.stats?.newCards || 0}</span>
                        <span class="collection-stat-label">New</span>
                    </div>
                    <div class="collection-stat">
                        <span class="collection-stat-value">${collection.stats?.totalCards || 0}</span>
                        <span class="collection-stat-label">Total</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Show new collection modal
     */
    function showNewCollectionModal() {
        document.getElementById('new-collection-form').reset();
        showModal('new-collection-modal');
    }

    /**
     * Create a new collection
     */
    async function createCollection(event) {
        event.preventDefault();

        const name = document.getElementById('collection-name').value.trim();
        const description = document.getElementById('collection-desc').value.trim();

        if (!name) {
            showNotification('Please enter a collection name', 'warning');
            return;
        }

        try {
            const collection = await Storage.collections.create({ name, description });
            closeModal();
            await loadCollections();
            showNotification('Collection created!', 'success');
            emit('collection:created', collection);
        } catch (error) {
            showNotification('Failed to create collection', 'error');
        }
    }

    /**
     * Open a collection
     */
    function openCollection(collectionId) {
        state.currentCollection = collectionId;
        navigateTo('browse', { collectionId });
    }

    /**
     * Show collection options modal
     */
    function showCollectionOptions(collectionId) {
        state.currentCollection = collectionId;
        showModal('collection-options-modal');
    }

    /**
     * Study collection
     */
    function studyCollection() {
        closeModal();
        navigateTo('study', { collectionId: state.currentCollection });
    }

    /**
     * Browse collection cards
     */
    function browseCollection() {
        closeModal();
        navigateTo('browse', { collectionId: state.currentCollection });
    }

    /**
     * Export collection
     */
    async function exportCollection() {
        closeModal();

        try {
            const { blob, filename } = await Export.exportCollection(state.currentCollection);
            Export.downloadBlob(blob, filename);
            showNotification('Collection exported!', 'success');
        } catch (error) {
            showNotification('Failed to export collection', 'error');
        }
    }

    /**
     * Edit collection name
     */
    async function editCollectionName() {
        closeModal();

        const collection = await Storage.collections.get(state.currentCollection);
        const newName = prompt('Enter new name:', collection.name);

        if (newName && newName.trim() && newName !== collection.name) {
            try {
                await Storage.collections.update(state.currentCollection, { name: newName.trim() });
                await loadCollections();
                showNotification('Collection renamed!', 'success');
            } catch (error) {
                showNotification('Failed to rename collection', 'error');
            }
        }
    }

    /**
     * Delete collection
     */
    function deleteCollection() {
        closeModal();

        showConfirm(
            'Delete Collection',
            'Are you sure you want to delete this collection and all its cards? This cannot be undone.',
            async () => {
                try {
                    await Storage.collections.delete(state.currentCollection);
                    state.currentCollection = null;
                    await loadCollections();
                    showNotification('Collection deleted', 'success');
                } catch (error) {
                    showNotification('Failed to delete collection', 'error');
                }
            }
        );
    }

    /**
     * Trigger import file dialog
     */
    function triggerImport() {
        document.getElementById('import-file').click();
    }

    /**
     * Handle import file selection
     */
    async function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        event.target.value = '';

        try {
            const result = await Export.importCollection(file);
            await loadCollections();
            showNotification(`Imported "${result.collection.name}" with ${result.cardsImported} cards!`, 'success');
        } catch (error) {
            if (error.errors) {
                showNotification(`Import failed: ${error.errors[0]}`, 'error');
            } else {
                showNotification('Failed to import file', 'error');
            }
        }
    }

    /**
     * Load browse view
     */
    async function loadBrowseView(collectionId) {
        const collection = await Storage.collections.get(collectionId);
        const cards = await Storage.cards.getByCollection(collectionId);

        document.getElementById('browse-collection-name').textContent = collection.name;

        const container = document.getElementById('cards-list');
        const emptyState = document.getElementById('empty-cards');

        if (cards.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'flex';
        emptyState.style.display = 'none';

        renderCardsList(cards);
    }

    /**
     * Render cards list
     */
    function renderCardsList(cards) {
        const container = document.getElementById('cards-list');

        container.innerHTML = cards.map(card => `
            <div class="card-list-item" onclick="App.editCard('${card.id}')">
                <div class="card-list-content">
                    <div class="card-list-front">${escapeHtml(card.front.text.substring(0, 100))}</div>
                    <div class="card-list-back">${escapeHtml(card.back.text.substring(0, 100))}</div>
                </div>
                <div class="card-list-meta">
                    <span class="card-status ${card.sr.state}">${card.sr.state}</span>
                    <button class="btn btn-icon btn-small" onclick="event.stopPropagation(); App.confirmDeleteCard('${card.id}')">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Search cards
     */
    async function searchCards() {
        const query = document.getElementById('search-cards').value.toLowerCase();
        const cards = await Storage.cards.getByCollection(state.currentCollection);

        const filtered = cards.filter(card =>
            card.front.text.toLowerCase().includes(query) ||
            card.back.text.toLowerCase().includes(query) ||
            card.tags.some(tag => tag.toLowerCase().includes(query))
        );

        renderCardsList(filtered);
    }

    /**
     * Show card editor
     */
    function showCardEditor(cardId = null) {
        state.editingCard = cardId;
        state.cardMedia = {
            front: { images: [], audio: [] },
            back: { images: [], audio: [] }
        };

        document.getElementById('card-form').reset();
        document.getElementById('card-id').value = '';
        document.getElementById('card-collection-id').value = state.currentCollection;
        document.getElementById('editor-title').textContent = cardId ? 'Edit Card' : 'New Card';

        // Clear media previews
        document.getElementById('front-media').innerHTML = '';
        document.getElementById('back-media').innerHTML = '';

        if (cardId) {
            loadCardEditor(cardId);
        }

        navigateTo('editor');
    }

    /**
     * Load card into editor
     */
    async function loadCardEditor(cardId) {
        const card = await Storage.cards.get(cardId);
        if (!card) {
            showNotification('Card not found', 'error');
            goBack();
            return;
        }

        state.editingCard = cardId;
        state.currentCollection = card.collectionId;

        document.getElementById('card-id').value = card.id;
        document.getElementById('card-collection-id').value = card.collectionId;
        document.getElementById('front-text').value = card.front.text;
        document.getElementById('back-text').value = card.back.text;
        document.getElementById('card-tags').value = card.tags.join(', ');
        document.getElementById('editor-title').textContent = 'Edit Card';

        // Load media
        state.cardMedia = {
            front: {
                images: [...(card.front.images || [])],
                audio: [...(card.front.audio || [])]
            },
            back: {
                images: [...(card.back.images || [])],
                audio: [...(card.back.audio || [])]
            }
        };

        renderMediaPreview('front');
        renderMediaPreview('back');
    }

    /**
     * Edit a card
     */
    function editCard(cardId) {
        showCardEditor(cardId);
    }

    /**
     * Save card
     */
    async function saveCard(event) {
        event.preventDefault();

        const cardId = document.getElementById('card-id').value;
        const collectionId = document.getElementById('card-collection-id').value;
        const frontText = document.getElementById('front-text').value.trim();
        const backText = document.getElementById('back-text').value.trim();
        const tagsInput = document.getElementById('card-tags').value.trim();

        if (!frontText || !backText) {
            showNotification('Please enter both front and back content', 'warning');
            return;
        }

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

        const cardData = {
            collectionId,
            front: {
                text: frontText,
                images: state.cardMedia.front.images,
                audio: state.cardMedia.front.audio
            },
            back: {
                text: backText,
                images: state.cardMedia.back.images,
                audio: state.cardMedia.back.audio
            },
            tags
        };

        try {
            if (cardId) {
                await Storage.cards.update(cardId, cardData);
                showNotification('Card updated!', 'success');
            } else {
                await Storage.cards.create(cardData);
                showNotification('Card created!', 'success');
            }

            // Go back to browse view
            navigateTo('browse', { collectionId });
        } catch (error) {
            showNotification('Failed to save card', 'error');
        }
    }

    /**
     * Cancel editing
     */
    function cancelEdit() {
        goBack();
    }

    /**
     * Confirm delete card
     */
    function confirmDeleteCard(cardId) {
        showConfirm(
            'Delete Card',
            'Are you sure you want to delete this card?',
            async () => {
                try {
                    await Storage.cards.delete(cardId);
                    await loadBrowseView(state.currentCollection);
                    showNotification('Card deleted', 'success');
                } catch (error) {
                    showNotification('Failed to delete card', 'error');
                }
            }
        );
    }

    /**
     * Add media to card being edited
     */
    function addMediaToCard(side, type, attachment) {
        if (type === 'image') {
            state.cardMedia[side].images.push(attachment);
        } else {
            state.cardMedia[side].audio.push(attachment);
        }
        renderMediaPreview(side);
    }

    /**
     * Remove media from card
     */
    function removeMedia(side, type, id) {
        if (type === 'image') {
            state.cardMedia[side].images = state.cardMedia[side].images.filter(m => m.id !== id);
        } else {
            state.cardMedia[side].audio = state.cardMedia[side].audio.filter(m => m.id !== id);
        }
        renderMediaPreview(side);
    }

    /**
     * Render media preview
     */
    function renderMediaPreview(side) {
        const container = document.getElementById(`${side}-media`);
        const media = state.cardMedia[side];

        let html = '';

        // Images
        media.images.forEach(img => {
            html += `
                <div class="media-item">
                    <img src="${img.data}" alt="Card image">
                    <button class="media-remove" onclick="App.removeMedia('${side}', 'image', '${img.id}')">&times;</button>
                </div>
            `;
        });

        // Audio
        media.audio.forEach(aud => {
            html += `
                <div class="media-item">
                    <audio controls src="${aud.data}"></audio>
                    <button class="media-remove" onclick="App.removeMedia('${side}', 'audio', '${aud.id}')">&times;</button>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Start study session
     */
    async function startStudySession(collectionId) {
        const collection = await Storage.collections.get(collectionId);
        const allCards = await Storage.cards.getByCollection(collectionId);

        // Get due cards
        let dueCards = SRAlgorithm.getDueCards(allCards);

        // Apply daily limits
        const newLimit = collection.settings?.newCardsPerDay || 20;
        const reviewLimit = collection.settings?.reviewsPerDay || 200;

        const newCards = dueCards.filter(c => c.sr.state === 'new').slice(0, newLimit);
        const reviewCards = dueCards.filter(c => c.sr.state !== 'new').slice(0, reviewLimit);
        dueCards = [...reviewCards, ...newCards];

        // Sort into optimal order
        dueCards = SRAlgorithm.sortStudyQueue(dueCards);

        // Initialize session
        state.studySession = {
            collectionId,
            collectionName: collection.name,
            settings: collection.settings,
            queue: dueCards,
            currentIndex: 0,
            reviewed: 0,
            correct: 0,
            startTime: Date.now()
        };

        document.getElementById('study-collection-name').textContent = collection.name;

        if (dueCards.length === 0) {
            showStudyComplete();
        } else {
            showNextCard();
        }
    }

    /**
     * Show next card in study session
     */
    function showNextCard() {
        const session = state.studySession;

        if (session.currentIndex >= session.queue.length) {
            showStudyComplete();
            return;
        }

        const card = session.queue[session.currentIndex];
        state.currentCard = card;

        // Update progress
        updateStudyProgress();

        // Show front
        const frontContent = document.querySelector('#card-front .card-text');
        const frontMedia = document.querySelector('#card-front .card-media');
        frontContent.textContent = card.front.text;
        frontMedia.innerHTML = renderCardMedia(card.front);

        // Hide back
        document.getElementById('card-back').style.display = 'none';

        // Show "Show Answer" button
        document.getElementById('show-answer-btn').style.display = 'block';
        document.getElementById('rating-buttons').style.display = 'none';

        // Auto-play audio if enabled
        if (state.settings.autoPlayAudio && card.front.audio?.length > 0) {
            Media.playAudio(card.front.audio[0].data);
        }

        // Show card, hide complete screen
        document.getElementById('study-card').style.display = 'block';
        document.getElementById('study-actions').style.display = 'block';
        document.getElementById('study-complete').style.display = 'none';
    }

    /**
     * Show answer
     */
    function showAnswer() {
        const card = state.currentCard;

        // Show back
        const backContent = document.querySelector('#card-back .card-text');
        const backMedia = document.querySelector('#card-back .card-media');
        backContent.textContent = card.back.text;
        backMedia.innerHTML = renderCardMedia(card.back);
        document.getElementById('card-back').style.display = 'block';

        // Update buttons
        document.getElementById('show-answer-btn').style.display = 'none';
        document.getElementById('rating-buttons').style.display = 'flex';

        // Update time estimates
        const estimates = SRAlgorithm.getIntervalEstimates(card, state.studySession.settings);
        document.getElementById('time-again').textContent = estimates[0];
        document.getElementById('time-hard').textContent = estimates[1];
        document.getElementById('time-good').textContent = estimates[2];
        document.getElementById('time-easy').textContent = estimates[3];

        // Auto-play audio if enabled
        if (state.settings.autoPlayAudio && card.back.audio?.length > 0) {
            Media.playAudio(card.back.audio[0].data);
        }
    }

    /**
     * Rate card
     */
    async function rateCard(quality) {
        const card = state.currentCard;
        const session = state.studySession;

        // Calculate next review
        const srUpdate = SRAlgorithm.calculateNextReview(card, quality, session.settings);

        // Save to storage
        await Storage.cards.update(card.id, { sr: srUpdate });

        // Update session stats
        session.reviewed++;
        if (quality >= 2) {
            session.correct++;
        }

        // If "Again" was pressed, re-add to end of queue
        if (quality === 0) {
            const updatedCard = await Storage.cards.get(card.id);
            session.queue.push(updatedCard);
        }

        // Move to next card
        session.currentIndex++;
        showNextCard();

        emit('card:reviewed', { card, quality });
    }

    /**
     * Update study progress display
     */
    function updateStudyProgress() {
        const session = state.studySession;
        const total = session.queue.length;
        const current = session.currentIndex + 1;

        document.getElementById('study-progress-text').textContent = `${current} / ${total}`;

        const percentage = (session.currentIndex / total) * 100;
        document.getElementById('study-progress-bar').style.width = `${percentage}%`;
    }

    /**
     * Show study complete screen
     */
    function showStudyComplete() {
        const session = state.studySession;
        const timeSpent = Math.round((Date.now() - session.startTime) / 60000);

        document.getElementById('study-card').style.display = 'none';
        document.getElementById('study-actions').style.display = 'none';
        document.getElementById('study-complete').style.display = 'block';

        document.getElementById('stat-reviewed').textContent = session.reviewed;
        document.getElementById('stat-correct').textContent = session.correct;
        document.getElementById('stat-time').textContent = timeSpent < 1 ? '< 1m' : `${timeSpent}m`;

        // Update collection stats
        Storage.collections.updateStats(session.collectionId);

        emit('study:completed', session);
    }

    /**
     * Render card media (images and audio)
     */
    function renderCardMedia(content) {
        let html = '';

        if (content.images?.length) {
            content.images.forEach(img => {
                html += `<img src="${img.data}" alt="Card image" onclick="App.showImageFull('${img.data}')">`;
            });
        }

        if (content.audio?.length) {
            content.audio.forEach(aud => {
                html += `<audio controls src="${aud.data}"></audio>`;
            });
        }

        return html;
    }

    /**
     * Show image fullscreen
     */
    function showImageFull(dataUrl) {
        // Simple fullscreen image view
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:2000;cursor:pointer;';
        overlay.onclick = () => overlay.remove();

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;';

        overlay.appendChild(img);
        document.body.appendChild(overlay);
    }

    /**
     * Show settings modal
     */
    function showSettings() {
        showModal('settings-modal');
    }

    /**
     * Show modal
     */
    function showModal(modalId) {
        document.getElementById('modal-overlay').style.display = 'flex';

        // Hide all modals first
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

        // Show target modal
        document.getElementById(modalId).style.display = 'block';
    }

    /**
     * Close modal
     */
    function closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }

    /**
     * Show confirmation dialog
     */
    function showConfirm(title, message, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        const confirmBtn = document.getElementById('confirm-action-btn');
        confirmBtn.onclick = () => {
            closeModal();
            onConfirm();
        };

        showModal('confirm-modal');
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    /**
     * Event emitter
     */
    function on(event, callback) {
        if (!eventListeners[event]) {
            eventListeners[event] = [];
        }
        eventListeners[event].push(callback);
    }

    function emit(event, data) {
        if (eventListeners[event]) {
            eventListeners[event].forEach(callback => callback(data));
        }
    }

    /**
     * Utility: Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Utility: Debounce
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        init,
        navigateTo,
        showNotification,
        showNewCollectionModal,
        createCollection,
        openCollection,
        showCollectionOptions,
        studyCollection,
        browseCollection,
        exportCollection,
        editCollectionName,
        deleteCollection,
        showCardEditor,
        editCard,
        saveCard,
        cancelEdit,
        confirmDeleteCard,
        addMediaToCard,
        removeMedia,
        showImageFull,
        closeModal,
        updateSetting,
        on
    };
})();
