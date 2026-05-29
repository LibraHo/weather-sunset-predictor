import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../../server/scripts/gfs_grid_parser.py');

describe('gfs_grid_parser.py', () => {
  test('downsamples against the global source grid, not arbitrary bbox edges', () => {
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('def aligned_to_global_grid(value, step):');
    expect(script).toContain('ratio = value / step');
    expect(script).not.toContain('aligned(lat, args.south');
    expect(script).not.toContain('aligned(lon, args.west');
  });

  test('maps cfgrib short names for expanded GFS weather fields', () => {
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('"r2": "RH"');
    expect(script).toContain('"u10": "UGRD"');
    expect(script).toContain('"v10": "VGRD"');
    expect(script).toContain('"sdswrf": "DSWRF"');
    expect(script).toContain('"avg_lcc": "LCDC"');
    expect(script).toContain('record["values"].setdefault(field, number)');
  });
});
