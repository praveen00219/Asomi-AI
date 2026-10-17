/**
 * Baseline env for the test suite.
 *
 * AI_PROVIDER=mock means config.ts does not demand an ANTHROPIC_API_KEY, so
 * `npm test` passes on a clean checkout with no secrets. Tests that need a
 * different config set it themselves and call resetConfigForTests().
 */

process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.PORT = '3999';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.MVP_API_KEY;
