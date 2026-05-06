import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const geoJsonPath = path.resolve(__dirname, '../../../public/data/east-asia-basemap-geojson.json');
const eastAsiaGeoJson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

describe('east-asia-basemap-geojson basemap coverage', () => {
  it('includes Southeast Asia countries for the firecloud map basemap only', () => {
    const names = new Set((eastAsiaGeoJson.features || []).map(feature => feature.properties?.name));

    ['Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Indonesia'].forEach((name) => {
      expect(names.has(name)).toBe(true);
    });
  });
});
