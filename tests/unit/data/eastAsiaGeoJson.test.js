import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const geoJsonPath = path.resolve(__dirname, '../../../public/data/east-asia-basemap-geojson.json');
const eastAsiaGeoJson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

function countGeometryCoordinates(geometry) {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, polygon) => (
      sum + polygon.reduce((ringSum, ring) => ringSum + ring.length, 0)
    ), 0);
  }
  return 0;
}

describe('east-asia-basemap-geojson basemap coverage', () => {
  it('includes Southeast Asia countries for the firecloud map basemap only', () => {
    const names = new Set((eastAsiaGeoJson.features || []).map(feature => feature.properties?.name));

    ['Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Indonesia', 'Mongolia'].forEach((name) => {
      expect(names.has(name)).toBe(true);
    });
  });

  it('includes Central Asia, South Asia, Russia, and Australia country boundaries', () => {
    const names = new Set((eastAsiaGeoJson.features || []).map(feature => feature.properties?.name));

    [
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan', 'Turkmenistan',
      'Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka', 'Maldives',
      'Russia', 'Australia'
    ].forEach((name) => {
      expect(names.has(name)).toBe(true);
    });
  });

  it('includes Mongolia as a northern basemap country', () => {
    const mongolia = (eastAsiaGeoJson.features || []).find(feature => feature.properties?.name === 'Mongolia');
    expect(mongolia).toBeTruthy();
    expect(['Polygon', 'MultiPolygon']).toContain(mongolia.geometry?.type);
    expect(countGeometryCoordinates(mongolia.geometry)).toBeGreaterThan(70);
  });

  it('uses detailed boundaries for large new basemap countries', () => {
    const russia = (eastAsiaGeoJson.features || []).find(feature => feature.properties?.name === 'Russia');
    const australia = (eastAsiaGeoJson.features || []).find(feature => feature.properties?.name === 'Australia');

    expect(russia).toBeTruthy();
    expect(australia).toBeTruthy();
    expect(countGeometryCoordinates(russia.geometry)).toBeGreaterThan(2000);
    expect(countGeometryCoordinates(australia.geometry)).toBeGreaterThan(500);
  });

  it('uses a detailed Japan coastline instead of a coarse country outline', () => {
    const japan = (eastAsiaGeoJson.features || []).find(feature => feature.properties?.name === 'Japan');
    expect(japan).toBeTruthy();
    expect(japan.geometry?.type).toBe('MultiPolygon');
    expect(japan.geometry.coordinates.length).toBeGreaterThan(100);
    expect(countGeometryCoordinates(japan.geometry)).toBeGreaterThan(5000);
  });
});
