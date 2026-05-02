# 霞客 Agent API Tool Schemas

这些示例用于 Claude / OpenAI / OpenClaw 等 Agent 以工具方式调用霞客受控 API。所有 `/api/agent/*` 接口都需要 `Authorization: Bearer <xiake_live_xxx>`，不要把真实 Token 写入 prompt、仓库或前端代码。

Base URL: `https://sunset.bjhyc.online`

## OpenAI / 通用 function calling

```json
{
  "type": "function",
  "function": {
    "name": "xiake_forecast",
    "description": "Get structured sunrise/sunset fire-cloud forecast from Xiake. Requires a server-side Bearer token.",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string", "description": "City or place name, e.g. Beijing" },
        "lat": { "type": "number", "minimum": -90, "maximum": 90 },
        "lon": { "type": "number", "minimum": -180, "maximum": 180 },
        "type": { "type": "string", "enum": ["sunrise", "sunset"], "default": "sunset" },
        "date": { "type": "string", "description": "today, tomorrow, or YYYY-MM-DD", "default": "today" },
        "detail": { "type": "string", "enum": ["simple", "full"], "default": "simple" }
      },
      "oneOf": [
        { "required": ["location"] },
        { "required": ["lat", "lon"] }
      ]
    }
  }
}
```

## Claude tool 示例

```json
{
  "name": "xiake_forecast",
  "description": "查询霞客火烧云朝霞/晚霞结构化预测。调用方必须在服务端注入 Bearer Token。",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": { "type": "string", "description": "地点名称，例如 北京、Tokyo" },
      "lat": { "type": "number" },
      "lon": { "type": "number" },
      "type": { "type": "string", "enum": ["sunrise", "sunset"] },
      "date": { "type": "string", "description": "today / tomorrow / YYYY-MM-DD" },
      "detail": { "type": "string", "enum": ["simple", "full"] }
    }
  }
}
```

## OpenClaw tool adapter 示例

```json
{
  "name": "xiake_forecast",
  "method": "GET",
  "url": "https://sunset.bjhyc.online/api/agent/forecast",
  "headers": {
    "Authorization": "Bearer ${XIAKE_AGENT_TOKEN}"
  },
  "query": {
    "location": "{{location}}",
    "lat": "{{lat}}",
    "lon": "{{lon}}",
    "type": "{{type}}",
    "date": "{{date}}",
    "detail": "{{detail}}"
  }
}
```

## 其他可用接口

- `GET /api/agent/explain`：返回分数构成、因子关系、关键限制和自然语言解释。
- `GET /api/agent/geocode?q=`：返回标准地点、国家、经纬度、confidence、rankReason。
- `GET /api/agent/map-summary?bbox=west,south,east,north&type=sunset&threshold=60`：返回区域火烧云摘要和高分点，不暴露完整图层。
- `GET /api/agent/openapi.json`：机器可读 OpenAPI 文档。

## 安全约束

- 禁止商用；仅限个人、研究、测试、非商业用途。
- Token 只放在服务端或受控 secret store，不放前端页面、公开仓库、聊天记录。
- Agent 不应编造预测结论；接口失败时应明确返回失败，而不是用常识代替 API。
