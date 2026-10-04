# melearn UX prototype design contract

This document describes the visual system currently present in this prototype. It is not a production design approval or a mandate to redesign existing screens.

## Product boundary

- This checkout is a React/Vite UX prototype. It is not the production app, an API, or a payment integration.
- Keep the existing accepted navigation and page flows. New screens should feel native to the existing application rather than introducing a second visual system.
- Prefer the installed Ant Design components for data-heavy/forms and the installed Mantine components where the existing shell already uses them. Do not add a component library for a single screen.
- Use Lucide/Tabler/Ant icons already installed. Do not use emoji as interface icons.

## Existing tokens

The token owner is `src/system-theme.css`. Reference its CSS variables before adding a color or spacing value.

- Brand/action: `--primary` (currently cobalt blue, `#0074e8`).
- Text: `--ink`, `--ink-secondary`, `--ink-tertiary`.
- Surfaces: white, `--canvas`, and the existing light-blue surface tokens.
- Borders: `--line` and `--line-strong`.
- Type: Anuphan, loaded in `src/main.jsx`.
- Shape: use the existing control/card radii and restrained shadows; do not add a second radius scale.

## Component rules

- One primary action per decision area; destructive actions use explicit confirmation and remain visually secondary until confirmation.
- Use semantic headings, labels, buttons, links, status text, and visible keyboard focus. Never communicate status by color alone.
- Keep tables readable on narrow screens with deliberate horizontal overflow or a compact alternative; never clip actions.
- Forms must have visible labels and useful validation text. Loading/saving/error/empty states reserve stable space and do not silently discard input.
- For uploaded images, show accepted types, count/size limits, filename, preview/removal, and failure feedback. Browser persistence is prototype-only and is not secure file storage.

## Accessibility and motion

- Support keyboard navigation, reduced motion, browser zoom/reflow, and touch targets appropriate to the action.
- Do not add animation that delays access to content or obscures focus.
- New charts must have a text/table equivalent; this slice uses labeled metrics and tables rather than color-only graphs.

## Change discipline

If a screen conflicts with this contract, document the specific conflict and propose a focused correction. Do not copy a reference prototype's visual system wholesale or infer product policy from styling.
