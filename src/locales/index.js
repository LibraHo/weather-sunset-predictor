/**
 * 翻译文件加载入口
 * 动态加载和合并翻译
 */

// 导出所有翻译对象
export { default as zhCN } from './zh-CN.js';
export { default as zhTW } from './zh-TW.js';
export { default as enUS } from './en-US.js';
export { default as jaJP } from './ja-JP.js';
export { default as koKR } from './ko-KR.js';
export { default as viVN } from './vi-VN.js';
export { default as frFR } from './fr-FR.js';
export { default as esES } from './es-ES.js';
export { default as itIT } from './it-IT.js';
export { default as arSA } from './ar-SA.js';

/**
 * 获取指定语言的翻译对象
 * @param {string} lang - 语言代码
 * @returns {Object|null} 翻译对象
 */
export async function getTranslation(lang) {
  try {
    switch (lang) {
      case 'zh-CN':
        return (await import('./zh-CN.js')).default;
      case 'zh-TW':
        return (await import('./zh-TW.js')).default;
      case 'en-US':
        return (await import('./en-US.js')).default;
      case 'ja-JP':
        return (await import('./ja-JP.js')).default;
      case 'ko-KR':
        return (await import('./ko-KR.js')).default;
      case 'vi-VN':
        return (await import('./vi-VN.js')).default;
      case 'fr-FR':
        return (await import('./fr-FR.js')).default;
      case 'es-ES':
        return (await import('./es-ES.js')).default;
      case 'it-IT':
        return (await import('./it-IT.js')).default;
      case 'ar-SA':
        return (await import('./ar-SA.js')).default;
      default:
        console.warn(`Unsupported language: ${lang}, falling back to zh-CN`);
        return (await import('./zh-CN.js')).default;
    }
  } catch (error) {
    console.error(`Failed to load translation for ${lang}:`, error);
    return null;
  }
}

/**
 * 合并多个翻译对象
 * @param {Object} base - 基础翻译对象
 * @param {Object} override - 覆盖翻译对象
 * @returns {Object} 合并后的翻译对象
 */
export function mergeTranslations(base, override) {
  const result = { ...base };

  for (const key in override) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = mergeTranslations(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }

  return result;
}
