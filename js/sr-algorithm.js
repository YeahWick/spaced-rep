/**
 * Spaced Repetition Algorithm Module
 * Implements SM-2 based algorithm for scheduling card reviews
 */

const SRAlgorithm = (function() {
    // Learning steps in minutes
    const DEFAULT_LEARNING_STEPS = [1, 10];
    const DEFAULT_GRADUATING_INTERVAL = 1; // days
    const DEFAULT_EASY_INTERVAL = 4; // days
    const MIN_EASE_FACTOR = 1.3;
    const DEFAULT_EASE_FACTOR = 2.5;

    /**
     * Get today's date string (YYYY-MM-DD)
     */
    function todayString() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Add days to a date and return date string
     */
    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }

    /**
     * Apply fuzz factor to prevent cards bunching up
     */
    function applyFuzz(interval) {
        if (interval <= 7) return interval;
        const fuzz = interval * 0.05;
        return Math.round(interval + (Math.random() * 2 - 1) * fuzz);
    }

    /**
     * Calculate the next review parameters for a card
     * @param {Object} card - The card being reviewed
     * @param {number} quality - Rating 0-3 (Again, Hard, Good, Easy)
     * @param {Object} settings - Collection settings
     * @returns {Object} Updated SR fields
     */
    function calculateNextReview(card, quality, settings = {}) {
        const learningSteps = settings.learningSteps || DEFAULT_LEARNING_STEPS;
        const graduatingInterval = settings.graduatingInterval || DEFAULT_GRADUATING_INTERVAL;
        const easyInterval = settings.easyInterval || DEFAULT_EASY_INTERVAL;

        const sr = { ...card.sr };
        const now = new Date();
        const today = todayString();

        // Record this review in history
        sr.history = sr.history || [];
        sr.history.push({
            date: now.toISOString(),
            quality,
            interval: sr.interval,
            easeFactor: sr.easeFactor
        });
        sr.lastReview = now.toISOString();

        // Handle based on current state
        if (sr.state === 'new' || sr.state === 'learning') {
            return handleLearningCard(sr, quality, learningSteps, graduatingInterval, easyInterval, today);
        } else {
            return handleReviewCard(sr, quality, today);
        }
    }

    /**
     * Handle learning/new cards
     */
    function handleLearningCard(sr, quality, learningSteps, graduatingInterval, easyInterval, today) {
        if (quality === 0) {
            // Again: restart learning
            sr.state = 'learning';
            sr.learningStep = 0;
            sr.repetitions = 0;
            // Due in first learning step (minutes)
            sr.dueDate = today;
            return sr;
        }

        if (quality === 3) {
            // Easy: graduate immediately with easy interval
            sr.state = 'review';
            sr.interval = easyInterval;
            sr.dueDate = addDays(today, easyInterval);
            sr.repetitions = 1;
            sr.learningStep = 0;
            return sr;
        }

        // Good or Hard: progress through learning steps
        const nextStep = sr.learningStep + 1;

        if (nextStep >= learningSteps.length) {
            // Graduate to review
            sr.state = 'review';
            sr.interval = graduatingInterval;
            sr.dueDate = addDays(today, graduatingInterval);
            sr.repetitions = 1;
            sr.learningStep = 0;
        } else {
            // Continue learning
            sr.state = 'learning';
            sr.learningStep = nextStep;
            sr.dueDate = today; // Learning cards stay due today
        }

        return sr;
    }

    /**
     * Handle review cards
     */
    function handleReviewCard(sr, quality, today) {
        if (quality === 0) {
            // Again: card lapses, back to learning
            sr.state = 'learning';
            sr.learningStep = 0;
            sr.repetitions = 0;
            sr.easeFactor = Math.max(MIN_EASE_FACTOR, sr.easeFactor - 0.2);
            sr.interval = Math.max(1, Math.round(sr.interval * 0.5)); // Halve the interval
            sr.dueDate = today;
            return sr;
        }

        // Adjust ease factor based on quality
        // EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
        const efDelta = 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02);
        sr.easeFactor = Math.max(MIN_EASE_FACTOR, sr.easeFactor + efDelta);

        // Calculate new interval
        let newInterval;
        if (sr.repetitions === 0) {
            newInterval = 1;
        } else if (sr.repetitions === 1) {
            newInterval = 6;
        } else {
            newInterval = Math.round(sr.interval * sr.easeFactor);
        }

        // Apply quality modifier
        if (quality === 1) {
            // Hard: reduce interval by 20%
            newInterval = Math.round(newInterval * 0.8);
        } else if (quality === 3) {
            // Easy: increase interval by 30%
            newInterval = Math.round(newInterval * 1.3);
        }

        // Apply fuzz
        newInterval = applyFuzz(newInterval);

        // Ensure minimum interval of 1 day
        newInterval = Math.max(1, newInterval);

        sr.interval = newInterval;
        sr.dueDate = addDays(today, newInterval);
        sr.repetitions += 1;

        return sr;
    }

    /**
     * Get cards due for review
     */
    function getDueCards(cards, date = new Date()) {
        const dateString = date.toISOString().split('T')[0];

        return cards.filter(card => {
            if (card.sr.state === 'new') return true;
            if (card.sr.state === 'learning') return true;
            if (card.sr.dueDate && card.sr.dueDate <= dateString) return true;
            return false;
        });
    }

    /**
     * Get new cards up to limit
     */
    function getNewCards(cards, limit) {
        return cards
            .filter(card => card.sr.state === 'new')
            .slice(0, limit);
    }

    /**
     * Sort cards into optimal study order
     * Priority: Overdue review > Due review > Learning > New
     */
    function sortStudyQueue(cards) {
        const today = todayString();

        // Separate cards by category
        const overdue = [];
        const dueReview = [];
        const learning = [];
        const newCards = [];

        cards.forEach(card => {
            if (card.sr.state === 'new') {
                newCards.push(card);
            } else if (card.sr.state === 'learning') {
                learning.push(card);
            } else if (card.sr.dueDate) {
                if (card.sr.dueDate < today) {
                    overdue.push(card);
                } else if (card.sr.dueDate === today) {
                    dueReview.push(card);
                }
            }
        });

        // Sort overdue by how overdue they are (oldest first)
        overdue.sort((a, b) => a.sr.dueDate.localeCompare(b.sr.dueDate));

        // Sort due reviews by ease factor (harder cards first)
        dueReview.sort((a, b) => a.sr.easeFactor - b.sr.easeFactor);

        // Learning cards by step
        learning.sort((a, b) => a.sr.learningStep - b.sr.learningStep);

        // Combine in priority order
        return [...overdue, ...dueReview, ...learning, ...newCards];
    }

    /**
     * Calculate statistics for a set of cards
     */
    function getStudyStats(cards) {
        const today = todayString();
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;
        let totalEase = 0;

        cards.forEach(card => {
            totalEase += card.sr.easeFactor;

            if (card.sr.state === 'new') {
                newCount++;
                dueToday++; // New cards are always "due"
            } else if (card.sr.state === 'learning') {
                learningCount++;
                dueToday++; // Learning cards are always "due"
            } else {
                reviewCount++;
                if (card.sr.dueDate && card.sr.dueDate <= today) {
                    dueToday++;
                }
            }
        });

        return {
            total: cards.length,
            new: newCount,
            learning: learningCount,
            review: reviewCount,
            dueToday,
            averageEase: cards.length > 0 ? totalEase / cards.length : DEFAULT_EASE_FACTOR
        };
    }

    /**
     * Get estimated intervals for display
     */
    function getIntervalEstimates(card, settings = {}) {
        const estimates = {};

        [0, 1, 2, 3].forEach(quality => {
            const result = calculateNextReview({ ...card }, quality, settings);
            estimates[quality] = formatInterval(result.interval, result.state);
        });

        return estimates;
    }

    /**
     * Format interval for display
     */
    function formatInterval(interval, state) {
        if (state === 'learning') {
            return '< 1d';
        }

        if (interval === 0) return '< 1d';
        if (interval === 1) return '1d';
        if (interval < 30) return `${interval}d`;
        if (interval < 365) return `${Math.round(interval / 30)}mo`;
        return `${(interval / 365).toFixed(1)}y`;
    }

    /**
     * Calculate retention rate from review history
     */
    function calculateRetention(cards) {
        let totalReviews = 0;
        let correctReviews = 0;

        cards.forEach(card => {
            if (card.sr.history) {
                card.sr.history.forEach(review => {
                    totalReviews++;
                    if (review.quality >= 2) {
                        correctReviews++;
                    }
                });
            }
        });

        return totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;
    }

    return {
        calculateNextReview,
        getDueCards,
        getNewCards,
        sortStudyQueue,
        getStudyStats,
        getIntervalEstimates,
        formatInterval,
        calculateRetention,
        MIN_EASE_FACTOR,
        DEFAULT_EASE_FACTOR
    };
})();
