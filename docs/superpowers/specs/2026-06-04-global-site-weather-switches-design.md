# Global Site And Weather Switches Design

## Approved Scope

Add two admin-controlled global switches:

- `siteClosed`: closes the public site.
- `weatherPredictionClosed`: closes weather prediction only.

When weather prediction is closed, Home menu pages other than prediction remain available. The homepage must not show search, geolocation query, re-query, or any other weather prediction action.

The same weather-unavailable UI is used when weather prediction data is unavailable but share map and firecloud map are still available.

## Admin UI

The global switches live in the admin console.

They use the same switch control as the web Settings Panel:

- `.setting-switch` size: `46px` by `28px`.
- Off state: gray track.
- On state: green `#22c55e` track.
- Knob: white `22px` circle moving `18px`.

The admin page keeps the existing admin console visual language: dark glass card, compact tab style, 4px card radius, and the existing amber primary action.

## Web Homepage UI

When weather prediction is unavailable, the homepage shows one simple glass card:

- Title locale key: `weather.unavailable.title`.
- Body locale key: `weather.unavailable.body`.
- Available entries: `home.shareMap`, `home.firecloudMap`.

The Chinese copy for those first two keys is:

- Title meaning: weather prediction is temporarily unavailable.
- Body meaning: please come back later.

Do not add technical explanation, reason text, labels, banners, diagnostic copy, or a complex fallback panel.

The web version supports light and dark themes through existing Xiake/Sunset Glass design tokens. It must avoid mini-program capsule styling on web controls.

## Mini Program Homepage UI

The mini program uses the same information hierarchy:

- Weather unavailable title.
- Short "please come back later" text.
- Entries for share map and firecloud map.

It supports both dark and light mini-program themes and keeps mini-program-native spacing and touch target sizing.

## Internationalization

All user-visible strings must be localized in the existing locale set.

Required semantic keys:

- `weather.unavailable.title`
- `weather.unavailable.body`
- `home.shareMap`
- `home.firecloudMap`
- `admin.globalSwitches.siteClosed.label`
- `admin.globalSwitches.siteClosed.status`
- `admin.globalSwitches.weatherPredictionClosed.label`
- `admin.globalSwitches.weatherPredictionClosed.status`

## Backend Behavior

The backend exposes admin-protected read/write APIs for the two switches and a public read API for current site/weather availability.

When `siteClosed` is enabled:

- Public site routes show a maintenance/closed state.
- Admin routes, health checks, and required static assets remain reachable.

When `weatherPredictionClosed` is enabled:

- Weather prediction APIs return a structured unavailable response.
- Share map and firecloud/firecloud map APIs remain available.
- The frontend hides prediction actions instead of allowing failed searches.

## Testing

Implementation should include focused tests for:

- Admin switch read/write persistence.
- Public availability API shape.
- Weather prediction APIs returning unavailable state when disabled.
- Share map and firecloud map still reachable when prediction is disabled.
- Web homepage hiding prediction actions and showing only the simple unavailable card.
- Mini-program homepage light/dark unavailable state.
- Locale key coverage for all supported languages.
