# Callout

A short multiplayer quiz: a Call of Duty loading screen comes up, and you name the map.

The roster is the mainline console games, from the original **Call of Duty** (2003) through **Black Ops 7** (2025). Handheld, mobile, Online, and Warzone maps are left out. Each game can be turned off. Launch maps are the ones that shipped with the game. The full locker adds the later maps.

There are two dailies: loading screens and minimaps. Each is ten launch maps, the same set for everyone on that date. You can open previous days from the calendar. Remake mode shows a map that came back and asks which game version it is. Nuketown stays out of minimap remakes because the layouts are almost identical. Custom matches still use the game filters, launch vs full locker, core / Face Off / battle size, loading screen or minimap, four choices or typed answers, a timer or no clock, and 5 / 10 / 15 / unlimited rounds. Size tags come from the wiki's Face Off, Gunfight, Ground War, Battle Map, Invasion, and Skirmish playlist pages (`python3 scripts/validate_scales.py`). Shipment, Rust, and Nuketown stay core even when they also rotate in Gunfight. Four-choice rounds last twenty seconds. Typed rounds last thirty, and typed names allow small spelling mistakes. Intel cuts that round's score in half. The earliest games have almost no minimaps on the wiki, so minimap mode skips them. Printed map names are painted out of the files, and the picture URLs are hashed so they do not spell the answer.

## Run it

```bash
npm install
npm run dev
```

Open the URL Next prints. Keys 1–4 answer a round. Enter continues.

`npm run build` writes a static site to `out/`. Use that for hosting. `next start` is not used.

## Host it (Cloudflare)

Connect [naathanbrown/cod-guesser](https://github.com/naathanbrown/cod-guesser) to a Workers or Pages project on `main`. The repo already has `wrangler.jsonc`, so Cloudflare uploads the static `out/` folder. Do **not** pick the Next.js / OpenNext worker preset — that path looks for a server build this app does not have.

If you are creating the project by hand:

- Framework preset: None (static assets)
- Build command: `npm run build`
- Output directory: `out`
- Node version: 22 (`.nvmrc` is in the repo)
- Environment variables: none

The first build copies every loading screen and minimap, so it will take a few minutes. After that, map images are static assets and do not count as Workers requests. Add a custom domain on the same project when you want a nicer URL.

## Images

Loading screens and minimaps are pulled from the [Call of Duty Wiki](https://callofduty.fandom.com/), then sealed into hashed files under `public/i/`. Map metadata lives in `src/data/maps.json`.

To fetch them again (needs Python and Pillow):

```bash
pip install pillow rapidocr-onnxruntime
python3 scripts/fetch_maps.py
python3 scripts/fetch_maps.py --minimaps
python3 scripts/hide_titles.py
```

This is a fan-made quiz. It is not affiliated with or endorsed by Activision. Call of Duty is a trademark of Activision Publishing, Inc.

The footer links to [Ko-fi](https://ko-fi.com/naathanbrown) if someone wants to tip. Change `KOFI_URL` in `src/components/game.tsx` if that is not your page.
