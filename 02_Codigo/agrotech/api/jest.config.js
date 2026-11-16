'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
