module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // Note: Coverage instrumentation doesn't work with dynamically loaded IIFE modules
  // Future work: Refactor modules to ES6 exports or use a bundler for proper coverage
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.test.js'
  ]
};
