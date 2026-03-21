process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.NODE_ENV = 'test';

// Direct mongodb-memory-server to store the binary inside the workspace.
// In CI (GitHub Actions ubuntu runner), the binary is downloaded automatically.
// Locally, set MONGOMS_DOWNLOAD_DIR to wherever suits your environment.
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  require('path').join(__dirname, '..', '.mongoms-binaries');

// Use a stable MongoDB 7.x build available on RHEL 9 / Ubuntu 22 runners.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';
