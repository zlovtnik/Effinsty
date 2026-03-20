# Effinsty Core Design Tokens

Effinsty Core is the active frontend token set for Effinsty. Color tokens are defined and exported as HSL tuples, then consumed through `hsl(var(--token))`.

## Core Tokens

### Brand and Semantic

| Token | HSL | HEX | Notes |
| --- | --- | --- | --- |
| `--primary` | `352 77% 49%` | `#DC1D38` | Main action color |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary |
| `--secondary` | `208 100% 32%` | `#0058A4` | Secondary action color |
| `--secondary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on secondary |
| `--accent` | `52 100% 65%` | `#FFE84F` | Highlight color |
| `--accent-foreground` | `240 10% 3.9%` | `#0A0E27` | Text on accent |
| `--success` | `142 72% 36%` | `#1AA14A` | Success state |
| `--warning` | `38 92% 50%` | `#F5A505` | Warning/caution state |
| `--info` | `200 98% 42%` | `#029DDB` | Informational state |
| `--destructive` | `347 70% 41%` | `#B21F3E` | Error/destructive actions |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |

### Surface and Text

| Token | HSL | HEX |
| --- | --- | --- |
| `--background` | `0 0% 100%` | `#FFFFFF` |
| `--foreground` | `240 10% 3.9%` | `#0A0E27` |
| `--card` | `0 0% 100%` | `#FFFFFF` |
| `--card-foreground` | `240 10% 3.9%` | `#0A0E27` |
| `--muted` | `240 4.8% 95.9%` | `#F3F4F6` |
| `--muted-foreground` | `240 3.8% 46.1%` | `#75757A` |
| `--border` | `240 5.9% 90%` | `#E5E7EB` |
| `--input` | `240 5.9% 90%` | `#E5E7EB` |
| `--ring` | `352 77% 49%` | `#DC1D38` |

### Shape Tokens

| Token | Value | Notes |
| --- | --- | --- |
| `--radius` | `0.75rem` | Base radius token (length) |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Small radius derived from base |
| `--radius-md` | `calc(var(--radius) - 2px)` | Medium radius derived from base |
| `--radius-lg` | `var(--radius)` | Large radius equals base |

### Dark Overrides

| Token | HSL | HEX |
| --- | --- | --- |
| `--background` | `240 10% 3.9%` | `#0A0E27` |
| `--foreground` | `0 0% 98%` | `#F7F7F7` |
| `--card` | `240 10% 3.9%` | `#0A0E27` |
| `--card-foreground` | `0 0% 98%` | `#F7F7F7` |
| `--muted` | `240 3.7% 15.9%` | `#1F2937` |
| `--muted-foreground` | `240 5% 64.9%` | `#A6A6B4` |
| `--border` | `240 3.7% 15.9%` | `#1F2937` |
| `--input` | `240 3.7% 15.9%` | `#1F2937` |
| `--success` | `142 62% 52%` | `#47D275` |
| `--warning` | `38 100% 64%` | `#FFC247` |
| `--info` | `200 100% 62%` | `#3DBEFF` |
| `--destructive` | `347 83% 62%` | `#EF4A71` |
| `--destructive-foreground` | `240 10% 3.9%` | `#0A0E27` |

## Migration Mapping (Legacy to Current)

| Legacy | Current |
| --- | --- |
| `--bg` | `--background` |
| `--text` | `--foreground` |
| `--surface` | `--card` |
| `--surface-muted` | `--muted` |
| `--text-muted` | `--muted-foreground` |
| `--danger` | `--destructive` |
| `--focus` | `--ring` |
| `--success` | `--success` |
| `--warning` | `--warning` |
| `--info` | `--info` |
| `--radius-sm/md/lg` | `calc(var(--radius) - 4px/-2px/0px)` |

## Theme Behavior

- System dark mode is enabled via `@media (prefers-color-scheme: dark)`.
- Explicit class overrides are supported:
- `.dark` forces dark tokens.
- `.light` forces light tokens.

## Export Snippets

### JSON

```json
{
  "colors": {
    "primary": "352 77% 49%",
    "secondary": "208 100% 32%",
    "accent": "52 100% 65%",
    "success": "142 72% 36%",
    "warning": "38 92% 50%",
    "info": "200 98% 42%",
    "destructive": "347 70% 41%",
    "foreground": "240 10% 3.9%",
    "background": "0 0% 100%"
  }
}
```

### SCSS

```scss
$primary-hsl: 352 77% 49%;
$secondary-hsl: 208 100% 32%;
$accent-hsl: 52 100% 65%;
$success-hsl: 142 72% 36%;
$warning-hsl: 38 92% 50%;
$info-hsl: 200 98% 42%;
$destructive-hsl: 347 70% 41%;
$foreground-hsl: 240 10% 3.9%;
$background-hsl: 0 0% 100%;
```

### CSS Custom Properties

```css
--primary: 352 77% 49%;
--secondary: 208 100% 32%;
--accent: 52 100% 65%;
--success: 142 72% 36%;
--warning: 38 92% 50%;
--info: 200 98% 42%;
--destructive: 347 70% 41%;
--foreground: 240 10% 3.9%;
--background: 0 0% 100%;
```
