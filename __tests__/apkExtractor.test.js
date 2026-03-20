const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

jest.mock('unzipper', () => ({
  Open: {
    file: jest.fn()
  }
}));

const unzipper = require('unzipper');
const { extractApk, resolveApkSourcePath, isApkPath } = require('../src/core/apkExtractor');

describe('apkExtractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveApkSourcePath prefers assets with main.js', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-apk-'));
    const assetsPath = path.join(root, 'assets');
    fs.mkdirSync(assetsPath, { recursive: true });
    fs.writeFileSync(path.join(assetsPath, 'main.js'), 'window.CCSettings = {};');

    const resolved = resolveApkSourcePath(root);

    expect(resolved).toBe(assetsPath);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('extractApk skips entries escaping destination', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-apk-'));
    const pathTraversalPath = `../evil-${Date.now()}.txt`;
    const escapedTarget = path.resolve(root, pathTraversalPath);

    unzipper.Open.file.mockResolvedValue({
      files: [
        { path: pathTraversalPath, type: 'File', stream: () => Readable.from('evil') },
        { path: 'assets/main.js', type: 'File', stream: () => Readable.from('main') }
      ]
    });

    await extractApk('/tmp/sample.apk', root);

    expect(fs.existsSync(path.join(root, 'assets', 'main.js'))).toBe(true);
    expect(fs.existsSync(escapedTarget)).toBe(false);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('isApkPath returns false for missing file', () => {
    expect(isApkPath('/tmp/not-found.apk')).toBe(false);
  });
});
