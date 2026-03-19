# 中国火烧云连续图层（Overlay）研究增量（2026-03-20）

## 背景

当前 `/api/spots/china` 已提供离散散点（score>=60），适合快速浏览。
下一步需要支持“连续图层渲染”，让用户直观看到区域过渡（不是孤立点）。

## 本次结论（可直接用于实现）

### 1) 数据模型建议：Grid Raster + Metadata

推荐后端输出统一网格（而非前端现场插值）：

```json
{
  "date": "2026-03-20",
  "updatedAt": "2026-03-20T07:00:00.000Z",
  "bbox": [72, 18, 135, 53],
  "resolution": 0.5,
  "width": 127,
  "height": 71,
  "valueRange": [0, 100],
  "noData": -1,
  "values": [ ... row-major ... ],
  "meta": {
    "interpolation": "idw",
    "idwPower": 2,
    "source": "china-spots-cache"
  }
}
```

说明：
- `values` 使用一维 row-major，减少 JSON 体积与解析开销。
- `noData=-1`，前端可透明处理。
- `resolution=0.5°` 作为首版平衡点（质量/体积/性能）。

### 2) 插值算法建议：IDW（反距离加权）

首版采用 IDW，原因：
- 实现简单、可解释、可控；
- 对离散点密度不均匀场景容错较好；
- 比克里金等复杂算法更适合当前工程节奏。

参数建议：
- `power = 2`
- `maxRadiusKm = 350`
- `minNeighbors = 3`

当邻居不足时输出 `noData`，避免伪精度。

### 3) 渲染路径建议：Leaflet CanvasOverlay（非逐 marker）

前端建议：
1. 拉取 raster grid。
2. 以 CanvasOverlay 按当前视图裁剪渲染。
3. 使用固定色带（0~100）并支持 alpha 渐变。
4. 与散点层可叠加：
   - 连续层：表达趋势；
   - 散点层：表达采样证据点。

### 4) API 草案（下一步）

- `GET /api/spots/china/raster?resolution=0.5&time=...`
- 响应使用上述 Grid Raster 结构。

## 风险与规避

1. **插值过平滑导致误导**
   - 规避：保留散点层开关；UI 标注“插值估算层”。
2. **弱网下 payload 过大**
   - 规避：首版支持 gzip；后续可切 tile/quantization。
3. **边界外扩导致海域高分伪影**
   - 规避：中国边界 mask（后续 GeoJSON 裁剪）。

## 下一步建议

1. 后端新增 `raster` 接口 PoC（0.5°，IDW）。
2. 前端新增 `ChinaContinuousOverlay`（Canvas 渲染 + 色带图例）。
3. 对比“仅散点 / 散点+连续层”可读性并收集反馈。
