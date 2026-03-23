# 「分享地图」菜单入口验证

## 验证结果 ✅

经检查，`index.html` 中已存在「分享地图」菜单入口，功能正常，无需修改。

### 代码位置
文件：`index.html` 第 96 行

```html
<button class="home-view-option" role="menuitemradio" aria-checked="false" data-view="gallery" onclick="window.open('/gallery','_blank')">分享地图</button>
```

### 验证项目

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 菜单入口存在 | ✅ | 位于 `.home-view-menu-dropdown` 中 |
| 跳转功能正常 | ✅ | `onclick="window.open('/gallery','_blank')"` 正确跳转 |
| 样式一致性 | ✅ | 使用 `.home-view-option` 类，与其他菜单项一致 |
| 暗色模式可见 | ✅ | 使用 `var(--color-text)` CSS 变量，自适应暗/亮模式 |
| 无障碍支持 | ✅ | 有 `role="menuitemradio"` 和 `aria-checked` 属性 |

### 样式确认

`styles/main.css` 第 244 行：
```css
.home-view-option {
  color: var(--color-text, #f0f0f0);
  ...
}
```

CSS 变量定义：
- 亮色模式：`--color-text: #333333`
- 暗色模式：`--color-text: rgba(255, 255, 255, 0.92)`

结论：功能已完备，无需代码修改。
