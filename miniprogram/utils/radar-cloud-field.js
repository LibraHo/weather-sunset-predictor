const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const DEFAULT_COLORS = {
  low: { r: 180, g: 210, b: 255, a: 0.98 },
  mid: { r: 210, g: 225, b: 255, a: 0.95 },
  high: { r: 235, g: 242, b: 255, a: 0.90 }
};

export function normalizeRadarDirections(directions = []) {
  const byDir = new Map((directions || []).map((item) => [item.direction, item]));
  return ORDER.map((direction) => {
    const item = byDir.get(direction) || {};
    return {
      direction,
      low: cover(item, 'lowCloud', 'low'),
      mid: cover(item, 'midCloud', 'mid'),
      high: cover(item, 'highCloud', 'high')
    };
  });
}

export function buildRadarCloudImageData(directions = [], size = 180) {
  const dirs = normalizeRadarDirections(directions);
  const px = new Uint8ClampedArray(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const rLowInner = size * 0.11;
  const rLow = size * 0.20;
  const rMid = size * 0.32;
  const rHigh = size * 0.42;
  const layers = [
    { key: 'low', inner: rLowInner * 1.02, outer: rLow * 0.96, fade: (rLow - rLowInner) * 0.46, alphaMax: 1.00, gamma: 0.96, color: DEFAULT_COLORS.low, edgeCut: 0.06 },
    { key: 'mid', inner: rLow * 1.01, outer: rMid * 1.00, fade: (rMid - rLow) * 0.46, alphaMax: 1.00, gamma: 0.92, color: DEFAULT_COLORS.mid, edgeCut: 0.07 },
    { key: 'high', inner: rMid * 1.00, outer: rHigh * 0.99, fade: (rHigh - rMid) * 0.50, alphaMax: 0.98, gamma: 0.88, color: DEFAULT_COLORS.high, edgeCut: 0.07 }
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius > rHigh * 1.02) continue;

      let theta = Math.atan2(dy, dx) + Math.PI / 2;
      if (theta < 0) theta += Math.PI * 2;

      let outR = 0;
      let outG = 0;
      let outB = 0;
      let outA = 0;

      for (const layer of layers) {
        if (radius < layer.inner - layer.fade || radius > layer.outer + layer.fade) continue;
        const ringW = smoothstep(layer.inner - layer.fade, layer.inner + layer.fade, radius)
          * (1 - smoothstep(layer.outer - layer.fade, layer.outer + layer.fade, radius));
        if (ringW <= 0.001) continue;

        const base = Math.pow(Math.max(0, interpolateCover(dirs, layer.key, theta)) / 100, layer.gamma);
        if (base <= 0.001) continue;

        const u = (theta / (Math.PI * 2)) * 12.5 * 8;
        const v = ((radius - (layer.inner + layer.outer) / 2) / Math.max(1, layer.outer - layer.inner)) * 1.6;
        const texture = 0.48 + 0.70 * fbm(u * 0.65, v * 0.55, 3) + 0.24 * (fbm(u * 1.6 + 21, v - 7, 2) - 0.5);
        const shaped = smoothstep(layer.edgeCut, 0.98, base * texture);
        const coverBoost = smoothstep(0.08, 0.72, base);
        const alpha = Math.max(0, Math.min(1, shaped * ringW * layer.alphaMax * layer.color.a * (0.55 + coverBoost * 0.55)));
        if (alpha <= 0.001) continue;

        const inv = 1 - outA;
        outR += layer.color.r * alpha * inv;
        outG += layer.color.g * alpha * inv;
        outB += layer.color.b * alpha * inv;
        outA += alpha * inv;
      }

      if (outA <= 0) continue;
      const idx = (y * size + x) * 4;
      px[idx] = Math.round(outR / outA);
      px[idx + 1] = Math.round(outG / outA);
      px[idx + 2] = Math.round(outB / outA);
      px[idx + 3] = Math.round(outA * 255);
    }
  }

  return { width: size, height: size, data: blurImageData(px, size, Math.max(1, Math.round(size * 0.011))) };
}

export function buildRadarCloudGradient(directions = []) {
  return buildRadarCloudGradients(directions).high;
}

export function buildRadarCloudGradients(directions = []) {
  return {
    high: buildLayerGradient(directions, 'high', '91, 122, 178', 0.18, 0.48),
    mid: buildLayerGradient(directions, 'mid', '106, 134, 187', 0.14, 0.42),
    low: buildLayerGradient(directions, 'low', '71, 104, 160', 0.10, 0.36)
  };
}

function buildLayerGradient(directions, layerKey, rgb, minAlpha, maxAlpha) {
  const dirs = normalizeRadarDirections(directions);
  const stops = dirs.map((item, index) => {
    const cloud = item[layerKey] || 0;
    const ratio = Math.max(0, Math.min(1, cloud / 100));
    const alpha = Math.round((minAlpha + ratio * (maxAlpha - minAlpha)) * 100) / 100;
    const start = index * 45;
    const end = start + 45;
    return `rgba(${rgb}, ${alpha}) ${start}deg ${end}deg`;
  });
  return `radial-gradient(circle, rgba(255,255,255,0) 0 19%, rgba(255,255,255,0.12) 20% 32%, rgba(255,255,255,0) 33% 100%), conic-gradient(from -22.5deg, ${stops.join(', ')})`;
}

export function paintRadarCloudCanvas(canvasId, directions, options = {}, size = 180) {
  if (!canvasId) return false;
  const wxApi = options.wxApi || options.wx || globalThis.wx;
  if (paintRadarCloudCanvasLegacy(canvasId, directions, wxApi, size)) return true;
  if (paintRadarCloudCanvas2d(canvasId, directions, { ...options, wxApi }, size)) return true;
  return false;
}

export function paintRadarCloudCanvas2d(canvasId, directions, options = {}, size = 180) {
  const wxApi = options.wxApi || options.wx || globalThis.wx;
  if (!wxApi?.createSelectorQuery) return false;
  const retry = options.retry ?? 4;
  const query = wxApi.createSelectorQuery();
  const scopedQuery = options.component && query.in ? query.in(options.component) : query;
  if (!scopedQuery?.select) return false;

  scopedQuery
    .select(`#${canvasId}`)
    .fields({ node: true, size: true })
    .exec((res = []) => {
      const canvas = res?.[0]?.node;
      if (!canvas?.getContext) {
        if (retry > 0) {
          setTimeout(() => {
            paintRadarCloudCanvas2d(canvasId, directions, { ...options, wxApi, retry: retry - 1 }, size);
          }, 120);
          return;
        }
        paintRadarCloudCanvasLegacy(canvasId, directions, wxApi, size);
        return;
      }

      const width = Math.max(1, Math.round(res[0].width || size));
      const height = Math.max(1, Math.round(res[0].height || width));
      const dpr = wxApi.getSystemInfoSync?.().pixelRatio || 1;
      const renderSize = Math.max(size, Math.round(Math.min(width, height) * dpr));
      const image = buildRadarCloudImageData(directions, renderSize);
      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext('2d');
      if (!ctx?.putImageData) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(createCanvasImageData(ctx, image), 0, 0);
    });

  return true;
}

function paintRadarCloudCanvasLegacy(canvasId, directions, wxApi = globalThis.wx, size = 180) {
  if (!wxApi?.canvasPutImageData) return false;
  const image = buildRadarCloudImageData(directions, size);
  wxApi.canvasPutImageData({
    canvasId,
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
    data: image.data
  });
  return true;
}

function createCanvasImageData(ctx, image) {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(image.data, image.width, image.height);
  }
  const target = ctx.createImageData(image.width, image.height);
  target.data.set(image.data);
  return target;
}

function cover(item = {}, field, layerKey) {
  const value = Number(item[field] ?? 0);
  if (Number.isFinite(value) && value > 0) return value;
  const matches = String(item.cloudText || '').match(/\d+(?:\.\d+)?/g) || [];
  const index = layerKey === 'high' ? 0 : (layerKey === 'mid' ? 1 : 2);
  const fallback = Number(matches[index] ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

function interpolateCover(dirs, key, theta) {
  const pos = theta / (Math.PI * 2) * ORDER.length;
  const i0 = Math.floor(pos) % ORDER.length;
  const i1 = (i0 + 1) % ORDER.length;
  const t = pos - Math.floor(pos);
  const a = dirs[i0]?.[key] ?? 0;
  const b = dirs[i1]?.[key] ?? 0;
  return a * (1 - t) + b * t;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function fbm(x, y, octaves) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * noise2d(x * frequency, y * frequency);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

function noise2d(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(0, 1, xf);
  const v = smoothstep(0, 1, yf);
  const n00 = hash(xi, yi);
  const n10 = hash(xi + 1, yi);
  const n01 = hash(xi, yi + 1);
  const n11 = hash(xi + 1, yi + 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blurImageData(data, size, radius) {
  if (radius <= 0) return data;
  const tmp = new Uint8ClampedArray(data.length);
  const out = new Uint8ClampedArray(data.length);
  boxBlurPass(data, tmp, size, radius, true);
  boxBlurPass(tmp, out, size, radius, false);
  return out;
}

function boxBlurPass(input, output, size, radius, horizontal) {
  const window = radius * 2 + 1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sx = horizontal ? clamp(x + offset, 0, size - 1) : x;
        const sy = horizontal ? y : clamp(y + offset, 0, size - 1);
        const idx = (sy * size + sx) * 4;
        const alpha = input[idx + 3] / 255;
        r += input[idx] * alpha;
        g += input[idx + 1] * alpha;
        b += input[idx + 2] * alpha;
        a += alpha;
      }
      const idx = (y * size + x) * 4;
      const alpha = a / window;
      if (alpha <= 0) {
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
        output[idx + 3] = 0;
        continue;
      }
      output[idx] = Math.round(r / a);
      output[idx + 1] = Math.round(g / a);
      output[idx + 2] = Math.round(b / a);
      output[idx + 3] = Math.round(alpha * 255);
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
