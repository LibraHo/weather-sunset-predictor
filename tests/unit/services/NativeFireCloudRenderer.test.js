import { scoreToRGBA } from '../../../src/services/NativeFireCloudRenderer.js';

describe('NativeFireCloudRenderer scoreToRGBA', () => {
  it('does not render scores below 40', () => {
    expect(scoreToRGBA(0)).toBeNull();
    expect(scoreToRGBA(20)).toBeNull();
    expect(scoreToRGBA(39)).toBeNull();
  });

  it('renders scores at 40 and above', () => {
    expect(scoreToRGBA(40)).not.toBeNull();
    expect(scoreToRGBA(64)).not.toBeNull();
    expect(scoreToRGBA(65)).not.toBeNull();
  });
});
