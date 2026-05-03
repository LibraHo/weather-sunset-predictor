const FORBIDDEN_ES_RESIDUE = [
  'Share Prediction',
  'Save Image',
  'Copy Link',
  'More Share',
  'Link Copied'
];

function flattenValues(value, prefix = '', out = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenValues(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }

  out.push({ key: prefix, value });
  return out;
}

describe('requirement 47.7 Spanish locale quality', () => {
  test('es-ES user-visible values do not contain known English fallback residue', async () => {
    const es = (await import('../../../src/locales/es-ES.js')).default;
    const offenders = flattenValues(es)
      .filter(({ value }) => typeof value === 'string' && FORBIDDEN_ES_RESIDUE.some((term) => value.includes(term)))
      .map(({ key, value }) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  test('primary feature-path Spanish copy is localized and readable', async () => {
    const es = (await import('../../../src/locales/es-ES.js')).default;

    expect(es.app.subtitle).toBe('Predecir el mejor momento para nubes rojas');
    expect(es.home.tabs.apiAccess).toBe('Acceso API');
    expect(es.home.tabs.shareMap).toBe('Mapa compartido');
    expect(es.prediction.canvas.aerosol).toBe('Aerosol');
    expect(es.share.title).toBe('Compartir predicción');
    expect(es.share.nativeShare).toBe('Más opciones para compartir');
    expect(es.settings.mapTileProvider).toBe('Mapa base');
    expect(es.errors.apiKeyInvalid).toBe('Clave API inválida, verifique la configuración');
  });
});
