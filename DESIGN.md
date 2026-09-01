---
name: Reethau Clean Energy & Inventory MS
description: Dark-mode precision energy showcase and industrial inventory platform
colors:
  primary: "#00D084"
  primary-hover: "#00B874"
  primary-dark: "#008754"
  bg-dark: "#0A0F1D"
  bg-card: "#141C2E"
  bg-card-hover: "#1A253C"
  text-main: "#FFFFFF"
  text-muted: "#94A3B8"
  text-dim: "#64748B"
  border-dark: "#1E293B"
  border-subtle: "rgba(255, 255, 255, 0.08)"
  status-in-stock: "#34D399"
  status-low-stock: "#FBBF24"
  status-critical: "#FCA5A5"
  status-maintenance: "#C084FC"
  accent-blue: "#60A5FA"
  backdrop-overlay: "rgba(0, 0, 0, 0.88)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  xs: "4px"
  sm: "6px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg-dark}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card-glass:
    backgroundColor: "rgba(20, 28, 46, 0.75)"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.lg}"
---

## Overview

Reethau Clean Energy's visual language is engineered for high-tech industrial reliability and clean energy leadership. It uses a deep midnight blue canvas (`#0A0F1D`) paired with vivid emerald green (`#00D084`) energy accents, high-legibility typography, crisp spatial hierarchy, and subtle glassmorphic panels.

## Colors

- **Primary Accent**: Emerald Clean Energy Green (`#00D084`, hover `#00B874`). Expresses sustainability, high energy efficiency, and operational vitality.
- **Background & Canvas**: Deep Midnight Dark (`#0A0F1D`). Reduces fatigue in industrial monitoring environments and creates strong visual depth.
- **Surface Cards**: Slate Navy (`#141C2E`) with subtle borders (`#1E293B` or `rgba(255,255,255,0.08)`).
- **Text & Hierarchy**: Primary White (`#FFFFFF`, contrast > 15:1), Muted Slate (`#94A3B8`, contrast >= 5.5:1), Dim Subtext (`#64748B`, contrast >= 4.5:1 against card backgrounds).
- **Status Badges**: Semantic operational indicators:
  - In Stock: `#34D399` with `rgba(16, 185, 129, 0.15)`
  - Low Stock: `#FBBF24` with `rgba(245, 158, 11, 0.15)`
  - Critical/Out of Stock: `#FCA5A5` with `rgba(239, 68, 68, 0.15)`
  - Maintenance: `#C084FC` with `rgba(168, 85, 247, 0.15)`

## Typography

- **Primary Font Family**: `Plus Jakarta Sans` via Google Fonts.
- **Display Headings**: Bold, impactful display hierarchy using `clamp()` fluid scales (max <= 3.75rem, letter-spacing >= -0.03em).
- **Subheadings**: Crisp semi-bold/bold weights with balanced text wrapping (`text-wrap: balance`).
- **Body & Captions**: Comfortable reading line length (max 70ch) with 1.6 line height.

## Elevation

- **Subtle Layering**: `0 4px 20px -2px rgba(0, 0, 0, 0.25)`
- **Card Depth**: `0 10px 30px -5px rgba(0, 0, 0, 0.35)`
- **Accent Glow**: `0 0 25px rgba(0, 208, 132, 0.25)`
- **Backdrop Blur**: `backdrop-filter: blur(16px)` for dialog overlays and floating navigation.

## Components

- **Buttons**: Pill-shaped primary actions (`border-radius: 9999px`) with glowing hover elevation. Ghost/Outline buttons with 1.5px subtle border and primary hover tint.
- **Cards**: Surface navy containers with 12px or 16px border radius (never hyper-rounded > 24px on standard rectangular cards). Clean 1px solid borders.
- **Tables & Lists**: High-density data grid with alternating row hovers, status pill badges, and accessible focus states.
- **Form Controls**: High-visibility dark inputs with focused emerald outlines (`ring-2 ring-#00D084`).

## Do's and Don'ts

- **DO** maintain strict high contrast (minimum 4.5:1) for body copy and subtext against dark backgrounds.
- **DO** use `text-wrap: balance` on section headings to avoid single word line orphans.
- **DO** ensure all buttons, tabs, and modals have explicit keyboard focus outlines (`focus-visible`).
- **DON'T** use multi-colored decorative gradient text hacks or side-stripe border accents on cards.
- **DON'T** use hyper-rounded 32px+ radii on content cards or data tables.
- **DON'T** use low-contrast dark gray text on dark blue backgrounds.
