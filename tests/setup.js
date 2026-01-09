// Jest test setup file
// Provides fake IndexedDB and other browser API mocks

require('fake-indexeddb/auto');

// Mock Date for consistent testing
const RealDate = Date;

global.mockDate = (dateString) => {
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(dateString);
      } else {
        super(...args);
      }
    }

    static now() {
      return new RealDate(dateString).getTime();
    }
  };
  global.Date.prototype = RealDate.prototype;
};

global.restoreDate = () => {
  global.Date = RealDate;
};

// Clean up after each test
afterEach(() => {
  global.restoreDate();
});
