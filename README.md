# Callout

A short multiplayer quiz: a Call of Duty loading screen comes up, and you name the map.

The roster runs from **Call of Duty 4: Modern Warfare** through **Black Ops II**:

- Call of Duty 4: Modern Warfare (2007)
- Call of Duty: World at War (2008)
- Call of Duty: Modern Warfare 2 (2009)
- Call of Duty: Black Ops (2010)
- Call of Duty: Modern Warfare 3 (2011)
- Call of Duty: Black Ops II (2012)

Launch maps are the default. The full locker adds the DLC maps from those games. Answer with four choices, or type the map name. Capitalization does not matter. A match can be 5, 10, or 15 rounds, or it can run until you end it. Intel reveals the game and cuts that round's score in half.

## Run it

```bash
npm install
npm run dev
```

Open the URL Next prints. Keys 1–4 answer a round. Enter continues.

## Images

Loading screens are pulled from the [Call of Duty Wiki](https://callofduty.fandom.com/) into `public/maps/`. Map metadata lives in `src/data/maps.json`.

To fetch them again (needs Python and Pillow):

```bash
pip install pillow
python3 scripts/fetch_maps.py
```

This is a fan-made quiz. It is not affiliated with or endorsed by Activision. Call of Duty is a trademark of Activision Publishing, Inc.
