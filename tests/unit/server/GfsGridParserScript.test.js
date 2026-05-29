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
});
