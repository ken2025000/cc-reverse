/*
 * @Date: 2026-03-20 09:40:48
 * @Description: APK 解压与路径解析工具
 */
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { fileManager } = require('../utils/fileManager');
const { logger } = require('../utils/logger');

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

  const markers = [
    'main.js',
    'settings.js',
    'project.js',
    path.join('src', 'settings.js'),
    path.join('src', 'project.js')
  ];

  return markers.some(marker => fs.existsSync(path.join(candidatePath, marker)));
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

    const rawEntryPath = entry.path.replace(/\\/g, '/');
    const normalizedEntryPath = rawEntryPath.replace(/^\/+/, '');

    const targetPath = path.normalize(path.resolve(basePath, normalizedEntryPath));
    if (!targetPath.startsWith(basePrefix)) {
      logger.warn(`跳过非法路径条目: ${entry.path}`);
      continue;
    }

    await fileManager.ensureDirectoryExists(path.dirname(targetPath));

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(targetPath);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);

      entry
        .stream()
        .on('error', reject)
        .pipe(writeStream);
    });
  }

  return basePath;
}

module.exports = {
  isApkPath,
  extractApk,
  resolveApkSourcePath
};
