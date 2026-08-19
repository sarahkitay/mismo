# Mismo Design Tokens

## Positioning

Mismo is a proactive risk management infrastructure platform.

Design intent: secure vault, calm authority, legal defensibility, HR empowerment.

## Color Tokens

```css
:root {
  --color-primary-900: #1f3f68;
  --color-primary-700: #2a507f;
  --color-primary-500: #3a6a9f;

  --color-emerald-600: #2c8c82;
  --color-emerald-500: #2b9b7f;
  --color-emerald-300: #5ec2b5;

  --color-alert-600: #c85b66;
  --color-alert-400: #d97a82;

  --color-accent-gold: #e2a63f;

  --color-surface-100: #ffffff;
  --color-surface-200: #edf1f6;
  --color-border-200: #d6dde6;

  --color-text-primary: #1a2430;
  --color-text-secondary: #5f6b7a;
  --color-text-muted: #8893a2;
}
```

## Typography Tokens

```css
:root {
  --font-heading: 'Cormorant Garamond', serif;
  --font-body: 'Inter', system-ui, sans-serif;

  --font-size-h1: 36px;
  --font-size-h2: 28px;
  --font-size-h3: 20px;
  --font-size-body: 15px;
  --font-size-caption: 13px;

  --line-height-tight: 1.2;
  --line-height-regular: 1.5;
}
```

## Spacing and Radius

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;

  --radius-small: 4px;
  --radius-medium: 6px;
  --radius-large: 8px;
}
```

## Shadow and Motion

```css
:root {
  --shadow-1: 0px 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-2: 0px 2px 8px rgba(0, 0, 0, 0.06);

  --transition-fast: 120ms ease-out;
  --transition-normal: 180ms ease-out;
  --transition-slow: 240ms ease-out;
}
```

Motion profile:
- No bounce
- No scale-up animations
- 4px vertical motion max
- Fade and subtle elevation only
