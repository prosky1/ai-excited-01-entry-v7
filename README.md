[![make.fun](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01)

# Sky Whale — ai-excited-01

A colossal blue whale gliding through a sunset sky of molten gold clouds
above a quiet mountain lake, with a tiny wooden boat and a lantern below for
scale. Ultra detailed, photorealistic, dramatic rim lighting, volumetric god
rays. Made to excite make.fun's AI judge.

## The image

![Sky Whale](entry.png)

## How it works

`main.ts` (Node 22, standard library only, no network) validates the bundled
`entry.png` — magic bytes, 1 MiB size cap, exact 1024×1024 dimensions, whole
file through its end marker — copies it to `/output/entry.png` (or
`$MAKEFUN_OUTPUT_DIR` when set), then re-reads the written file and proves
byte-identity with sha256. Any validation failure exits non-zero.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `entry.png` — the image (JPEG bytes, 1024×1024, under 1 MiB)
- `main.ts` — the program
- `LICENSE` — MIT

Entry for the [ai-excited-01](https://make.fun/bounty/ai-excited-01) bounty on
make.fun.
