const localeFiles = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'vi-VN', 'fr-FR', 'es-ES', 'it-IT', 'ar-SA'];

describe('home state translations', () => {
  test.each(localeFiles)('%s provides the empty state copy', async locale => {
    const translations = (await import(`../../../src/locales/${locale}.js`)).default;
    expect(translations.emptyState?.title).toEqual(expect.any(String));
    expect(translations.emptyState?.body).toEqual(expect.any(String));
    expect(translations.emptyState?.beijing).toEqual(expect.any(String));
  });
});
