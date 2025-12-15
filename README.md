<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Vhh8E5I2mlvSJEdfMjCZ4kF72U1vOcM1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

1. Build the production assets into `docs/` (the folder GitHub Pages serves):
   `npm run build`
2. Push the changes to `main`. GitHub Pages will serve `docs/index.html` at
   https://gondatje.github.io/castlerg/.
