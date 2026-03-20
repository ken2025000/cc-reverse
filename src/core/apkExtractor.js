/*
 * @Date: 2026-03-20 09:40:48
 * @Description: APK 解压与路径解析工具
 */
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { fileManager } = require('../utils/fileManager');
const { logger } = require('../utils/logger');

const COCOS_PROJECT_MARKERS = [
  'main.js',
  'settings.js',
  'project.js',
  path.join('src', 'settings.js'),
  path.join('src', 'project.js')
];

/**
 * 判断路径是否为 APK 文件
 * @param {string} inputPath 文件路径
 * @returns {boolean}
 */
function isApkPath(inputPath) {
  if (!inputPath || path.extname(inputPath).toLowerCase() !== '.apk') {
    return false;
  }

  try {
    return fs.existsSync(inputPath) && fs.statSync(inputPath).isFile();
  } catch (err) {
    return false;
  }
}

/**
 * 判断目录是否包含 Cocos Creator 项目关键文件
 * @param {string} candidatePath 目录路径
 * @returns {boolean}
 */
function looksLikeCocosProject(candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return false;
  }

  return COCOS_PROJECT_MARKERS.some(marker =>
    fs.existsSync(path.join(candidatePath, marker))
  );
}

/**
 * 解析 APK 解压后的 Cocos Creator 资源根目录
 * @param {string} extractedRoot 解压根目录
 * @returns {string}
 */
function resolveApkSourcePath(extractedRoot) {
  const candidates = [
    path.join(extractedRoot, 'assets'),
    path.join(extractedRoot, 'res'),
    extractedRoot
  ];

  for (const candidate of candidates) {
    if (looksLikeCocosProject(candidate)) {
      return candidate;
    }
  }

  return extractedRoot;
}

/**
 * 解压 APK 到指定目录
 * @param {string} apkPath APK 文件路径
 * @param {string} outputDir 解压目录
 * @returns {Promise<string>}
 */
async function extractApk(apkPath, outputDir) {
  const basePath = path.resolve(outputDir);
  const normalizedBasePath = path.normalize(basePath);
  const basePrefix = normalizedBasePath.endsWith(path.sep)
    ? normalizedBasePath
    : `${normalizedBasePath}${path.sep}`;

  await fileManager.ensureDirectoryExists(basePath);

  const directory = await unzipper.Open.file(apkPath);

  for (const entry of directory.files) {
    if (entry.type === 'Directory') {
      continue;
    }

    // 将 Windows 风格的分隔符统一为 '/'，便于进行跨平台路径校验
    const rawEntryPath = entry.path.replace(/\\/g, '/');
    const normalizedEntryPath = path
      .normalize(rawEntryPath)
      .replace(/^([/\\])+/, '');

    const entrySegments = normalizedEntryPath.split(/[\\/]+/);
    if (entrySegments.includes('..')) {
      logger.warn(`跳过非法路径条目: ${entry.path}`);
      continue;
    }

    const targetPath = path.normalize(path.resolve(basePath, normalizedEntryPath));
    if (!targetPath.startsWith(basePrefix)) {
      logger.warn(`跳过非法路径条目: ${entry.path}`);
      continue;
    }

    await fileManager.ensureDirectoryExists(path.dirname(targetPath));

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(targetPath);
      const entryStream = entry.stream();

      const handleError = err => {
        writeStream.destroy();
        reject(err);
      };

      writeStream.on('finish', resolve);
      writeStream.on('error', handleError);
      entryStream.on('error', handleError);

      entryStream.pipe(writeStream);
    });
  }

  return basePath;
}

module.exports = {
  isApkPath,
  extractApk,
  resolveApkSourcePath
};
