# Callout

A short multiplayer quiz: a Call of Duty loading screen comes up, and you name the map.

The roster is the mainline console games, from the original **Call of Duty** (2003) through **Black Ops 7** (2025). Handheld, mobile, Online, and Warzone maps are left out. Each game can be turned off. Launch maps are the ones that shipped with the game. The full locker adds the later maps.

There is a daily: ten launch maps, the same set for everyone on that date, plus a day streak if you come back tomorrow. Remake mode shows a map that came back and asks which game version it is. Custom matches still use the game filters, launch vs full locker, loading screen or minimap, four choices or typed answers, and 5 / 10 / 15 / unlimited rounds. Four-choice rounds last twenty seconds. Typed rounds last thirty. Intel cuts that round's score in half. The earliest games have almost no minimaps on the wiki, so minimap mode skips them. Printed map names are covered when OCR can read them.

## Run it

```bash
npm install
npm run dev
```

Open the URL Next prints. Keys 1–4 answer a round. Enter continues.

## Images

Loading screens and minimaps are pulled from the [Call of Duty Wiki](https://callofduty.fandom.com/) into `public/maps/` and `public/minimaps/`. Map metadata lives in `src/data/maps.json`.

To fetch them again (needs Python and Pillow):

```bash
pip install pillow rapidocr-onnxruntime
python3 scripts/fetch_maps.py
python3 scripts/fetch_maps.py --minimaps
python3 scripts/hide_titles.py
```

This is a fan-made quiz. It is not affiliated with or endorsed by Activision. Call of Duty is a trademark of Activision Publishing, Inc.
