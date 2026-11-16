// Sky Whale — ai-excited-01 entry (Node 22, standard library only, no network).
//
// Writes exactly one image to /output/entry.png (or $MAKEFUN_OUTPUT_DIR when
// set). The bundled image is a JPEG named entry.png; the gate tells PNG from
// JPEG by first bytes, so the name stays entry.png either way.
//
// The program validates the bundled image before copying it, then re-reads
// the written file and proves byte-identity with sha256:
//   - magic bytes: JPEG SOI (FF D8 FF) or PNG signature (89 50 4E 47 0D 0A 1A 0A)
//   - size at most 1 MiB (1048576 bytes)
//   - dimensions exactly 1024 x 1024 (JPEG SOF marker or PNG IHDR)
//   - JPEG must end with the EOI marker (FF D9); PNG must end with IEND
// It never deletes, creates, or empties the output directory itself — the
// grader runs as user nobody and removing /output fails with EACCES.
// (Guardrail: the output directory is only ever created, never removed.)
// Any validation failure exits non-zero with a clear error on stderr.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parsePngDimensions(buf) {
  // PNG: 8-byte signature, then IHDR chunk (length 4 + 'IHDR' 4 + width 4 + height 4).
  if (buf.length < 33) fail('PNG too short to hold an IHDR chunk');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') fail('PNG missing IHDR chunk');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function parseJpegDimensions(buf) {
  // JPEG: walk segments from offset 2 until a Start-Of-Frame marker (SOF0/1/2/3,
  // 0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF) gives height then width.
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) fail(`JPEG segment marker expected at offset ${offset}`);
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) fail('JPEG reached SOS before any SOF marker');
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buf.length) fail('JPEG segment overruns the file');
    const isSof =
      (marker >= 0xc0 && marker <= 0xcf) &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  fail('JPEG has no SOF marker');
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = join(here, 'entry.png');
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  if (!resolve(outDir)) fail('output directory must be an absolute path');
  const dest = join(outDir, 'entry.png');

  let sourceBuf;
  try {
    sourceBuf = readFileSync(source);
  } catch {
    fail(`cannot read bundled image: ${source}`);
  }

  if (sourceBuf.length === 0) fail('bundled image is empty');
  if (sourceBuf.length > MAX_BYTES) {
    fail(`bundled image is ${sourceBuf.length} bytes, over the 1048576-byte cap`);
  }

  const isJpeg = sourceBuf[0] === 0xff && sourceBuf[1] === 0xd8 && sourceBuf[2] === 0xff;
  const isPng =
    sourceBuf.length >= 8 &&
    sourceBuf[0] === 0x89 && sourceBuf[1] === 0x50 && sourceBuf[2] === 0x4e &&
    sourceBuf[3] === 0x47 && sourceBuf[4] === 0x0d && sourceBuf[5] === 0x0a &&
    sourceBuf[6] === 0x1a && sourceBuf[7] === 0x0a;
  if (!isJpeg && !isPng) fail('bundled image is neither JPEG nor PNG (bad magic bytes)');

  let dims;
  if (isJpeg) {
    dims = parseJpegDimensions(sourceBuf);
    if (sourceBuf[sourceBuf.length - 2] !== 0xff || sourceBuf[sourceBuf.length - 1] !== 0xd9) {
      fail('JPEG is truncated: missing EOI marker (FF D9)');
    }
  } else {
    dims = parsePngDimensions(sourceBuf);
    if (sourceBuf.toString('ascii', sourceBuf.length - 12, sourceBuf.length - 8) !== 'IEND') {
      fail('PNG is truncated: missing IEND chunk');
    }
  }
  if (dims.width !== EXPECTED_WIDTH || dims.height !== EXPECTED_HEIGHT) {
    fail(`bundled image is ${dims.width}x${dims.height}, expected 1024x1024`);
  }

  try {
    mkdirSync(outDir, { recursive: true });
  } catch {
    fail(`cannot create output directory: ${outDir}`);
  }
  try {
    copyFileSync(source, dest);
  } catch {
    fail(`cannot write output image: ${dest}`);
  }

  let writtenBuf;
  try {
    writtenBuf = readFileSync(dest);
  } catch {
    fail(`cannot re-read written image: ${dest}`);
  }
  const sourceHash = createHash('sha256').update(sourceBuf).digest('hex');
  const writtenHash = createHash('sha256').update(writtenBuf).digest('hex');
  if (sourceHash !== writtenHash) {
    fail(`written file sha256 ${writtenHash} does not match source ${sourceHash}`);
  }
  const writtenSize = statSync(dest).size;
  if (writtenSize !== sourceBuf.length) {
    fail(`written file is ${writtenSize} bytes, source is ${sourceBuf.length} bytes`);
  }

  console.log(`wrote ${dest} (${writtenSize} bytes, 1024x1024, sha256 ${writtenHash})`);
}

main();
