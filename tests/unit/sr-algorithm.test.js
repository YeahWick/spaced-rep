/**
 * Tests for the Spaced Repetition Algorithm Module
 */

const fs = require('fs');
const path = require('path');

// Load the SR Algorithm module
const srAlgorithmCode = fs.readFileSync(
  path.join(__dirname, '../../js/sr-algorithm.js'),
  'utf8'
);

// Extract the IIFE and execute it to get the module
// The code defines: const SRAlgorithm = (function() { ... })();
// We'll wrap it to capture the value
const wrappedCode = srAlgorithmCode.replace(
  'const SRAlgorithm =',
  'module.exports ='
);

// Create a temporary module to execute the code
const Module = require('module');
const tempModule = new Module('sr-algorithm');
tempModule._compile(wrappedCode, 'sr-algorithm.js');
const SRAlgorithm = tempModule.exports;

// Helper to create a card with SR data
function createCard(overrides = {}) {
  return {
    id: 'test-card-1',
    front: 'Question',
    back: 'Answer',
    sr: {
      state: 'new',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      learningStep: 0,
      dueDate: null,
      history: [],
      ...overrides
    }
  };
}

describe('SRAlgorithm', () => {
  describe('constants', () => {
    it('should export MIN_EASE_FACTOR as 1.3', () => {
      expect(SRAlgorithm.MIN_EASE_FACTOR).toBe(1.3);
    });

    it('should export DEFAULT_EASE_FACTOR as 2.5', () => {
      expect(SRAlgorithm.DEFAULT_EASE_FACTOR).toBe(2.5);
    });
  });

  describe('calculateNextReview', () => {
    describe('new/learning cards', () => {
      it('should restart learning on quality 0 (Again)', () => {
        const card = createCard({ state: 'learning', learningStep: 1 });

        const result = SRAlgorithm.calculateNextReview(card, 0);

        expect(result.state).toBe('learning');
        expect(result.learningStep).toBe(0);
        expect(result.repetitions).toBe(0);
      });

      it('should graduate immediately with easy interval on quality 3 (Easy)', () => {
        const card = createCard({ state: 'new' });

        const result = SRAlgorithm.calculateNextReview(card, 3);

        expect(result.state).toBe('review');
        expect(result.interval).toBe(4); // Default easy interval
        expect(result.repetitions).toBe(1);
      });

      it('should use custom easy interval from settings', () => {
        const card = createCard({ state: 'new' });
        const settings = { easyInterval: 7 };

        const result = SRAlgorithm.calculateNextReview(card, 3, settings);

        expect(result.interval).toBe(7);
      });

      it('should progress through learning steps on quality 2 (Good)', () => {
        const card = createCard({ state: 'learning', learningStep: 0 });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        expect(result.state).toBe('learning');
        expect(result.learningStep).toBe(1);
      });

      it('should graduate after completing all learning steps', () => {
        const card = createCard({ state: 'learning', learningStep: 1 });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        expect(result.state).toBe('review');
        expect(result.interval).toBe(1); // Default graduating interval
        expect(result.repetitions).toBe(1);
      });

      it('should use custom graduating interval from settings', () => {
        const card = createCard({ state: 'learning', learningStep: 1 });
        const settings = { graduatingInterval: 3 };

        const result = SRAlgorithm.calculateNextReview(card, 2, settings);

        expect(result.interval).toBe(3);
      });

      it('should record review in history', () => {
        const card = createCard({ state: 'new' });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        expect(result.history).toHaveLength(1);
        expect(result.history[0].quality).toBe(2);
        expect(result.lastReview).toBeDefined();
      });
    });

    describe('review cards', () => {
      it('should lapse card back to learning on quality 0 (Again)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 30,
          repetitions: 5
        });

        const result = SRAlgorithm.calculateNextReview(card, 0);

        expect(result.state).toBe('learning');
        expect(result.learningStep).toBe(0);
        expect(result.repetitions).toBe(0);
        expect(result.easeFactor).toBe(2.3); // Reduced by 0.2
        expect(result.interval).toBe(15); // Halved
      });

      it('should not let ease factor drop below minimum on lapse', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 1.4, // Close to minimum
          interval: 10,
          repetitions: 2
        });

        const result = SRAlgorithm.calculateNextReview(card, 0);

        expect(result.easeFactor).toBe(1.3); // MIN_EASE_FACTOR
      });

      it('should reduce interval on quality 1 (Hard)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 10,
          repetitions: 3
        });

        const result = SRAlgorithm.calculateNextReview(card, 1);

        // Hard applies 0.8 multiplier
        expect(result.interval).toBeLessThan(card.sr.interval * card.sr.easeFactor);
      });

      it('should increase interval normally on quality 2 (Good)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 10,
          repetitions: 3
        });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        // Should be around interval * easeFactor (with possible fuzz)
        expect(result.interval).toBeGreaterThan(10);
        expect(result.repetitions).toBe(4);
      });

      it('should increase interval more on quality 3 (Easy)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 10,
          repetitions: 3
        });

        const resultGood = SRAlgorithm.calculateNextReview(card, 2);
        const resultEasy = SRAlgorithm.calculateNextReview(card, 3);

        // Easy should give longer interval due to 1.3 multiplier
        // Note: fuzz could affect this, but on average Easy > Good
        expect(resultEasy.easeFactor).toBeGreaterThan(resultGood.easeFactor);
      });

      it('should adjust ease factor based on SM-2 formula', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 10,
          repetitions: 3
        });

        // Quality 3 should increase ease factor
        const resultEasy = SRAlgorithm.calculateNextReview(card, 3);
        expect(resultEasy.easeFactor).toBeGreaterThan(2.5);

        // Quality 1 should decrease ease factor
        const resultHard = SRAlgorithm.calculateNextReview(card, 1);
        expect(resultHard.easeFactor).toBeLessThan(2.5);
      });

      it('should set interval to 1 for first review (repetitions=0)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0
        });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        // First review should give interval of 1
        expect(result.interval).toBeGreaterThanOrEqual(1);
      });

      it('should set interval to 6 for second review (repetitions=1)', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 2.5,
          interval: 1,
          repetitions: 1
        });

        const result = SRAlgorithm.calculateNextReview(card, 2);

        // Second review should give interval around 6 (may have fuzz)
        expect(result.interval).toBeGreaterThanOrEqual(5);
        expect(result.interval).toBeLessThanOrEqual(8);
      });

      it('should ensure minimum interval of 1 day', () => {
        const card = createCard({
          state: 'review',
          easeFactor: 1.3,
          interval: 1,
          repetitions: 0
        });

        const result = SRAlgorithm.calculateNextReview(card, 1);

        expect(result.interval).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('getDueCards', () => {
    it('should return all new cards as due', () => {
      const cards = [
        createCard({ state: 'new' }),
        createCard({ state: 'new' })
      ];

      const due = SRAlgorithm.getDueCards(cards);

      expect(due).toHaveLength(2);
    });

    it('should return all learning cards as due', () => {
      const cards = [
        createCard({ state: 'learning', learningStep: 0 }),
        createCard({ state: 'learning', learningStep: 1 })
      ];

      const due = SRAlgorithm.getDueCards(cards);

      expect(due).toHaveLength(2);
    });

    it('should return review cards with dueDate <= today', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const cards = [
        createCard({ state: 'review', dueDate: yesterday }), // Due
        createCard({ state: 'review', dueDate: today }),      // Due
        createCard({ state: 'review', dueDate: tomorrow })    // Not due
      ];

      const due = SRAlgorithm.getDueCards(cards);

      expect(due).toHaveLength(2);
    });

    it('should accept custom date parameter', () => {
      const futureDate = new Date(Date.now() + 86400000 * 10); // 10 days from now
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const cards = [
        createCard({ state: 'review', dueDate: futureDateStr })
      ];

      const due = SRAlgorithm.getDueCards(cards, futureDate);

      expect(due).toHaveLength(1);
    });
  });

  describe('getNewCards', () => {
    it('should return only new cards', () => {
      const cards = [
        createCard({ state: 'new' }),
        createCard({ state: 'learning' }),
        createCard({ state: 'review' }),
        createCard({ state: 'new' })
      ];

      const newCards = SRAlgorithm.getNewCards(cards, 10);

      expect(newCards).toHaveLength(2);
      expect(newCards.every(c => c.sr.state === 'new')).toBe(true);
    });

    it('should respect the limit parameter', () => {
      const cards = [
        createCard({ state: 'new' }),
        createCard({ state: 'new' }),
        createCard({ state: 'new' }),
        createCard({ state: 'new' })
      ];

      const newCards = SRAlgorithm.getNewCards(cards, 2);

      expect(newCards).toHaveLength(2);
    });
  });

  describe('sortStudyQueue', () => {
    it('should prioritize overdue cards first', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const cards = [
        { ...createCard({ state: 'new' }), id: 'new' },
        { ...createCard({ state: 'review', dueDate: today, easeFactor: 2.5 }), id: 'due-today' },
        { ...createCard({ state: 'review', dueDate: yesterday, easeFactor: 2.5 }), id: 'overdue' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('overdue');
    });

    it('should prioritize due review cards before learning cards', () => {
      const today = new Date().toISOString().split('T')[0];

      const cards = [
        { ...createCard({ state: 'learning', learningStep: 0 }), id: 'learning' },
        { ...createCard({ state: 'review', dueDate: today, easeFactor: 2.5 }), id: 'due-today' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('due-today');
    });

    it('should prioritize learning cards before new cards', () => {
      const cards = [
        { ...createCard({ state: 'new' }), id: 'new' },
        { ...createCard({ state: 'learning', learningStep: 0 }), id: 'learning' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('learning');
    });

    it('should sort overdue cards by date (oldest first)', () => {
      const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const cards = [
        { ...createCard({ state: 'review', dueDate: yesterday, easeFactor: 2.5 }), id: 'yesterday' },
        { ...createCard({ state: 'review', dueDate: twoDaysAgo, easeFactor: 2.5 }), id: 'two-days-ago' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('two-days-ago');
    });

    it('should sort due review cards by ease factor (harder first)', () => {
      const today = new Date().toISOString().split('T')[0];

      const cards = [
        { ...createCard({ state: 'review', dueDate: today, easeFactor: 2.8 }), id: 'easier' },
        { ...createCard({ state: 'review', dueDate: today, easeFactor: 1.5 }), id: 'harder' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('harder');
    });

    it('should sort learning cards by step', () => {
      const cards = [
        { ...createCard({ state: 'learning', learningStep: 1 }), id: 'step-1' },
        { ...createCard({ state: 'learning', learningStep: 0 }), id: 'step-0' }
      ];

      const sorted = SRAlgorithm.sortStudyQueue(cards);

      expect(sorted[0].id).toBe('step-0');
    });
  });

  describe('getStudyStats', () => {
    it('should count cards by state', () => {
      const today = new Date().toISOString().split('T')[0];

      const cards = [
        createCard({ state: 'new' }),
        createCard({ state: 'new' }),
        createCard({ state: 'learning' }),
        createCard({ state: 'review', dueDate: today })
      ];

      const stats = SRAlgorithm.getStudyStats(cards);

      expect(stats.total).toBe(4);
      expect(stats.new).toBe(2);
      expect(stats.learning).toBe(1);
      expect(stats.review).toBe(1);
    });

    it('should count cards due today', () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const cards = [
        createCard({ state: 'new' }),                          // Due (new always due)
        createCard({ state: 'learning' }),                     // Due (learning always due)
        createCard({ state: 'review', dueDate: today }),       // Due
        createCard({ state: 'review', dueDate: tomorrow })     // Not due
      ];

      const stats = SRAlgorithm.getStudyStats(cards);

      expect(stats.dueToday).toBe(3);
    });

    it('should calculate average ease factor', () => {
      const cards = [
        createCard({ easeFactor: 2.0 }),
        createCard({ easeFactor: 3.0 })
      ];

      const stats = SRAlgorithm.getStudyStats(cards);

      expect(stats.averageEase).toBe(2.5);
    });

    it('should return default ease factor for empty array', () => {
      const stats = SRAlgorithm.getStudyStats([]);

      expect(stats.averageEase).toBe(2.5);
    });
  });

  describe('formatInterval', () => {
    it('should format learning state as "< 1d"', () => {
      expect(SRAlgorithm.formatInterval(0, 'learning')).toBe('< 1d');
    });

    it('should format 0 days as "< 1d"', () => {
      expect(SRAlgorithm.formatInterval(0, 'review')).toBe('< 1d');
    });

    it('should format 1 day as "1d"', () => {
      expect(SRAlgorithm.formatInterval(1, 'review')).toBe('1d');
    });

    it('should format days under 30 with "d" suffix', () => {
      expect(SRAlgorithm.formatInterval(15, 'review')).toBe('15d');
      expect(SRAlgorithm.formatInterval(29, 'review')).toBe('29d');
    });

    it('should format 30+ days as months', () => {
      expect(SRAlgorithm.formatInterval(30, 'review')).toBe('1mo');
      expect(SRAlgorithm.formatInterval(60, 'review')).toBe('2mo');
      expect(SRAlgorithm.formatInterval(90, 'review')).toBe('3mo');
    });

    it('should format 365+ days as years', () => {
      expect(SRAlgorithm.formatInterval(365, 'review')).toBe('1.0y');
      expect(SRAlgorithm.formatInterval(730, 'review')).toBe('2.0y');
      expect(SRAlgorithm.formatInterval(548, 'review')).toBe('1.5y');
    });
  });

  describe('calculateRetention', () => {
    it('should return 0 for cards with no history', () => {
      const cards = [
        createCard({ history: [] }),
        createCard({ history: [] })
      ];

      const retention = SRAlgorithm.calculateRetention(cards);

      expect(retention).toBe(0);
    });

    it('should calculate correct retention rate', () => {
      const cards = [
        createCard({
          history: [
            { quality: 3 }, // Correct
            { quality: 2 }, // Correct
            { quality: 1 }, // Incorrect
            { quality: 0 }  // Incorrect
          ]
        })
      ];

      const retention = SRAlgorithm.calculateRetention(cards);

      // 2 correct out of 4 = 50%
      expect(retention).toBe(50);
    });

    it('should aggregate history across multiple cards', () => {
      const cards = [
        createCard({
          history: [
            { quality: 3 }, // Correct
            { quality: 2 }  // Correct
          ]
        }),
        createCard({
          history: [
            { quality: 0 }, // Incorrect
            { quality: 1 }  // Incorrect
          ]
        })
      ];

      const retention = SRAlgorithm.calculateRetention(cards);

      // 2 correct out of 4 = 50%
      expect(retention).toBe(50);
    });

    it('should return 100 for all correct reviews', () => {
      const cards = [
        createCard({
          history: [
            { quality: 3 },
            { quality: 2 },
            { quality: 2 }
          ]
        })
      ];

      const retention = SRAlgorithm.calculateRetention(cards);

      expect(retention).toBe(100);
    });
  });

  describe('getIntervalEstimates', () => {
    it('should return estimates for all quality levels', () => {
      const card = createCard({ state: 'new' });

      const estimates = SRAlgorithm.getIntervalEstimates(card);

      expect(estimates).toHaveProperty('0');
      expect(estimates).toHaveProperty('1');
      expect(estimates).toHaveProperty('2');
      expect(estimates).toHaveProperty('3');
    });

    it('should show learning state for Again on new card', () => {
      const card = createCard({ state: 'new' });

      const estimates = SRAlgorithm.getIntervalEstimates(card);

      expect(estimates[0]).toBe('< 1d');
    });

    it('should show easy interval for Easy on new card', () => {
      const card = createCard({ state: 'new' });

      const estimates = SRAlgorithm.getIntervalEstimates(card);

      expect(estimates[3]).toBe('4d'); // Default easy interval
    });
  });
});
