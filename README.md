# Panel

`Panel` is a draggable bottom-sheet Web Component for mobile and desktop.

It is designed to be easy to drop into a website with one script tag and a small amount of HTML.

## CDN

Use your hosted file:

```html
<script type="module" src="https://components-5l2.pages.dev/app-panel.js"></script>
```

If you are testing locally in this project:

```html
<script type="module" src="./app-panel.js"></script>
```

## Fastest Setup

Copy and paste this into your page:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Panel Example</title>
    <script type="module" src="https://components-5l2.pages.dev/app-panel.js"></script>

    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
      }

      [data-panel-app] {
        min-height: 100vh;
      }
    </style>
  </head>
  <body>
    <div data-panel-app>
      <main style="padding: 24px;">
        <button data-panel-target="help-panel" data-panel-open="medium">
          Open panel
        </button>
      </main>
    </div>

    <app-panel
      id="help-panel"
      aria-label="Help panel"
      snaps="small medium large"
      default-snap="medium"
      scale-background
    >
      <div style="display: grid; gap: 16px;">
        <h2 style="margin: 0;">Hello from Panel</h2>
        <p style="margin: 0;">This panel opens at the medium snap point.</p>
        <button data-panel-action="close">Close</button>
      </div>
    </app-panel>
  </body>
</html>
```

## How It Works

1. Add the script tag.
2. Wrap your page content in an element with `data-panel-app` if you want the background to scale.
3. Add an `<app-panel>` with an `id`.
4. Add a button with `data-panel-target="your-panel-id"`.
5. Choose how it opens with `data-panel-open="small"`, `medium`, or `large`.

## Beginner Examples

### Open Small, Medium, or Large

```html
<button data-panel-target="menu-panel" data-panel-open="small">Small</button>
<button data-panel-target="menu-panel" data-panel-open="medium">Medium</button>
<button data-panel-target="menu-panel" data-panel-open="large">Large</button>

<app-panel id="menu-panel" aria-label="Menu" snaps="small medium large">
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Menu</h2>
    <p style="margin: 0;">The same panel can open at different sizes.</p>
  </div>
</app-panel>
```

### Toggle a Panel

```html
<button
  data-panel-target="settings-panel"
  data-panel-action="toggle"
  data-panel-open="medium"
>
  Toggle settings
</button>

<app-panel id="settings-panel" aria-label="Settings">
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Settings</h2>
    <button data-panel-action="close">Close</button>
  </div>
</app-panel>
```

### Buttons Inside the Panel

```html
<app-panel id="checkout-panel" aria-label="Checkout">
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Checkout</h2>

    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button data-panel-action="snap" data-panel-open="small">Small</button>
      <button data-panel-action="snap" data-panel-open="medium">Medium</button>
      <button data-panel-action="snap" data-panel-open="large">Large</button>
    </div>

    <button data-panel-action="close">Close</button>
  </div>
</app-panel>
```

### Stacked Panels (Apple-like layered flow)

```html
<button data-panel-target="parent-panel" data-panel-open="medium">Open parent</button>

<app-panel id="parent-panel" aria-label="Parent" stacked>
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Parent panel</h2>
    <button data-panel-target="child-panel" data-panel-open="large">
      Open child panel
    </button>
  </div>
</app-panel>

<app-panel id="child-panel" aria-label="Child" stacked>
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Child panel</h2>
    <p style="margin: 0;">
      The parent panel stays behind this one as a raised layer.
    </p>
    <button data-panel-action="close">Back</button>
  </div>
</app-panel>
```

### Start Open

```html
<app-panel
  id="welcome-panel"
  aria-label="Welcome"
  open
  default-snap="large"
>
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Welcome</h2>
    <p style="margin: 0;">This panel starts open.</p>
  </div>
</app-panel>
```

### Change Colors

```html
<app-panel
  id="brand-panel"
  aria-label="Brand panel"
  style="
    --app-panel-bg: rgba(22, 28, 45, 0.84);
    --app-panel-border: rgba(255, 255, 255, 0.12);
    --app-panel-handle: rgba(255, 255, 255, 0.28);
    --app-panel-backdrop: rgba(4, 8, 15, 0.52);
    color: white;
  "
>
  <div style="display: grid; gap: 16px;">
    <h2 style="margin: 0;">Custom colors</h2>
    <p style="margin: 0; color: rgba(255,255,255,0.75);">
      Panel uses CSS variables so each instance can look different.
    </p>
  </div>
</app-panel>
```

## Attributes

`id`
- Lets buttons target the panel.

`open`
- Opens the panel immediately.

`snaps="small medium large"`
- Controls which named snap sizes exist.

`default-snap="medium"`
- Chooses the snap used when the panel opens normally.

`scale-background`
- Scales and rounds the page behind the panel.

`stacked`
- Allows this panel to stack with other panels that also use `stacked`.

`drag-threshold="10"`
- Controls how far a touch must move before a close-drag can take over.

`scroll-handoff-delay="80"`
- Helps prevent accidental closing when the user is scrolling fast.

`close-projection="180"`
- Changes how strongly swipe velocity affects dismissal.

## Trigger Attributes

`data-panel-target="panel-id"`
- Tells a button which panel to control.

`data-panel-open="small|medium|large"`
- Opens or snaps the panel to a named size.

`data-panel-action="open|toggle|snap|close"`
- Controls what the button does.

## JavaScript API

If you want direct control:

```html
<script type="module">
  const panel = document.querySelector("#help-panel");

  panel.openAt("large");
  panel.snapTo("small");
  panel.close();
  panel.toggle();
<\/script>
```

## Events

```html
<script type="module">
  const panel = document.querySelector("#help-panel");

  panel.addEventListener("panel-open", (event) => {
    console.log("opened", event.detail.snap);
  });

  panel.addEventListener("panel-close", (event) => {
    console.log("closed", event.detail.reason);
  });

  panel.addEventListener("panel-snap-change", (event) => {
    console.log("snap changed", event.detail.snap);
  });
<\/script>
```

## Recommended First Use

If someone is not technical, this is the easiest path:

1. Upload `app-panel.js` to your site or CDN.
2. Paste the script tag into your page.
3. Paste the “Fastest Setup” example.
4. Change the text inside the button and panel.
5. Change `small`, `medium`, or `large` until it feels right.
