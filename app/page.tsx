"use client";

import { useEffect, useRef } from "react";
import "./globals.css";

const SC = 21;
const OY = 20;
const DURATION = 10_000;
const TICK = 16;
const ANIM = 42;
const LIFT = 34;
const GAP = 7;
const SIZES = [9, 10, 11, 12] as const;
const FONT = "Arial";
const DEFAULT_TEXT_COLOR = "#fdd7d7";
const DEFAULT_BG_COLOR = "#060208";
const FLICKER_COLOR = "#ff4d6d";
const FLICKER_INTERVAL = 200;

const PHRASES = [
  "I love you",
  "Seni seviyorum",
  "Te amo",
  "Je t'aime",
  "Ich liebe dich",
  "Ti amo",
  "Eu te amo",
  "Я тебя люблю",
  "사랑해",
  "愛してる",
  "我爱你",
  "मैं तुमसे प्यार करता हूँ",
  "Σ' αγαπώ",
  "Ik hou van jou",
  "Jag älskar dig",
  "Kocham cię",
  "ฉันรักเธอ",
  "Anh yêu em",
  "Aku cinta kamu",
  "Я тебе кохаю",
] as const;

type Vec3 = [number, number, number];
type Point = [number, number];
type Span = [number, number];

function parseCssColor(value: string): Vec3 {
  const trimmed = value.trim();

  if (trimmed.startsWith("#")) {
    const raw = trimmed.slice(1);
    const hex =
      raw.length === 3
        ? raw
            .split("")
            .map((part) => part + part)
            .join("")
        : raw;
    const number = Number.parseInt(hex, 16);

    return [
      ((number >> 16) & 255) / 255,
      ((number >> 8) & 255) / 255,
      (number & 255) / 255,
    ];
  }

  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map((value) => Number.parseFloat(value.trim()))
      .slice(0, 3);

    return [channels[0] / 255, channels[1] / 255, channels[2] / 255] as Vec3;
  }

  return parseCssColor(DEFAULT_TEXT_COLOR);
}

function cssColor(variable: string, fallback: string): Vec3 {
  if (typeof window === "undefined") {
    return parseCssColor(fallback);
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();

  return value ? parseCssColor(value) : parseCssColor(fallback);
}

const FLASH_FALLBACK: Vec3 = [1, 0.78, 0.78];
const BGC_FALLBACK: Vec3 = [6 / 255, 2 / 255, 8 / 255];

type PhraseItem = {
  x: number;
  y: number;
  text: string;
  size: number;
  width: number;
  color: Vec3;
  edge: boolean;
  rad: number;
  dx: number;
  f?: number;
  shadow?: number;
  halo?: number;
  main?: number;
};

type RandomGenerator = {
  next: () => number;
  uniform: (min: number, max: number) => number;
  choice: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: T[]) => T[];
};

function heart(a: number): Point {
  const x = 16 * Math.sin(a) ** 3;
  const y =
    13 * Math.cos(a) -
    5 * Math.cos(2 * a) -
    2 * Math.cos(3 * a) -
    Math.cos(4 * a);

  return [x * SC, y * SC + OY];
}

function mix(a: Vec3, b: Vec3, k: number): Vec3 {
  return a.map((v, i) => v + (b[i] - v) * k) as Vec3;
}

function dim(c: Vec3, k: number): Vec3 {
  return c.map((v) => v * k) as Vec3;
}

function hx(c: Vec3): string {
  return (
    "#" +
    c
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function createRandom(seed = 11): RandomGenerator {
  let state = seed >>> 0;

  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
    uniform(min: number, max: number) {
      return min + this.next() * (max - min);
    },
    choice<T>(items: readonly T[]): T {
      return items[Math.floor(this.next() * items.length)];
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
}

function mathDist(x: number, y: number, cy: number): number {
  return Math.hypot(x / (16 * SC), (y - cy) / (14.5 * SC));
}

function build(
  ctx: CanvasRenderingContext2D,
  textColor: Vec3,
  bgColor: Vec3,
): PhraseItem[] {
  const rng = createRandom(11);
  const polygon: Point[] = Array.from({ length: 720 }, (_, i) =>
    heart((2 * Math.PI * i) / 720),
  );

  const edges: [Point, Point][] = polygon.map((point, i) => [
    point,
    polygon[(i + 1) % polygon.length],
  ]);

  const ymax = Math.max(...polygon.map((p) => p[1]));
  const ymin = Math.min(...polygon.map((p) => p[1]));
  const cy = (ymax + ymin) / 2;

  const font = (size: number) => `bold ${size}px ${FONT}`;

  const rowH =
    Math.max(
      ...SIZES.map((size) => {
        ctx.font = font(size);
        return size * 1.4;
      }),
    ) + 4;

  function spans(y: number): Span[] {
    const xs: number[] = [];

    for (const [[x1, y1], [x2, y2]] of edges) {
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }

    xs.sort((a, b) => a - b);

    const result: Span[] = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      result.push([xs[i], xs[i + 1]]);
    }
    return result;
  }

  function intersect(a: Span[], b: Span[]): Span[] {
    const out: Span[] = [];

    for (const [a1, a2] of a) {
      for (const [b1, b2] of b) {
        const lo = Math.max(a1, b1);
        const hi = Math.min(a2, b2);

        if (hi - lo > 14) out.push([lo, hi]);
      }
    }

    return out;
  }

  let phraseOrder: string[] = [];
  let phraseIndex = 0;

  function nextPhrase(): string {
    if (phraseIndex >= phraseOrder.length) {
      phraseOrder = rng.shuffle([...PHRASES]);
      phraseIndex = 0;
    }

    return phraseOrder[phraseIndex++];
  }

  const placed: PhraseItem[] = [];

  for (let y = ymax - rowH / 2; y > ymin + rowH / 2; y -= rowH) {
    const rows = intersect(spans(y + rowH / 2), spans(y - rowH / 2));

    for (const [loRaw, hiRaw] of rows) {
      const lo = loRaw + 4;
      const hi = hiRaw - 4;
      let cur = lo + rng.uniform(0, 8);
      const line: Array<{
        x: number;
        text: string;
        size: number;
        width: number;
      }> = [];

      while (true) {
        let fit: { text: string; size: number; width: number } | null = null;

        for (let attempt = 0; attempt < 10; attempt++) {
          const text = nextPhrase();
          const size = rng.choice(SIZES);

          ctx.font = font(size);
          const width = ctx.measureText(text).width;

          if (cur + width <= hi) {
            fit = { text, size, width };
            break;
          }
        }

        if (!fit) break;

        line.push({
          x: cur + fit.width / 2,
          text: fit.text,
          size: fit.size,
          width: fit.width,
        });

        cur += fit.width + GAP;
      }

      if (!line.length) continue;

      if (line.length > 1) {
        const last = line[line.length - 1];
        const left = hi - (last.x + last.width / 2);

        line.forEach((item, i) => {
          item.x += (left * i) / (line.length - 1);
        });
      } else {
        line[0].x = (lo + hi) / 2;
      }

      line.forEach((item, i) => {
        const rad = Math.min(1, mathDist(item.x, y, cy));
        const shadow = mix(dim(textColor, 0.45), bgColor, 0.2);
        const highlight = mix(textColor, [1, 1, 1], 0.2);

        let color = mix(shadow, textColor, 0.3 + 0.7 * rad);

        color = mix(
          color,
          highlight,
          rng.uniform(0, 0.35) + (i === 0 || i === line.length - 1 ? 0.3 : 0),
        );

        placed.push({
          x: item.x,
          y,
          text: item.text,
          size: item.size,
          width: item.width,
          color: color.map((v) => Math.min(1, v)) as Vec3,
          edge: i === 0 || i === line.length - 1,
          rad,
          dx: rng.uniform(-10, 10),
          f: 0,
        });
      });
    }
  }

  const edgeItems = placed.filter((p) => p.edge);
  const innerItems = placed.filter((p) => !p.edge);

  edgeItems.sort(
    (a, b) =>
      ((Math.atan2(a.x, a.y - cy) + Math.PI * 2) % (Math.PI * 2)) -
      ((Math.atan2(b.x, b.y - cy) + Math.PI * 2) % (Math.PI * 2)),
  );

  innerItems.sort((a, b) => b.rad - a.rad);

  return [...edgeItems, ...innerItems];
}

export default function LoveHeart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const textColor = cssColor("--love-text-color", DEFAULT_TEXT_COLOR);
    const bgColor = cssColor("--love-page-bg", DEFAULT_BG_COLOR);
    const flashColor = mix(textColor, FLASH_FALLBACK, 0.5);
    const baseBgColor = mix(bgColor, BGC_FALLBACK, 0.5);
    const flickerColor = parseCssColor(FLICKER_COLOR);

    const ctx: CanvasRenderingContext2D = context;

    let animationFrame = 0;
    let timeoutId: number | undefined;
    let shimmerTimeoutId: number | undefined;
    let stopped = false;

    const width = 800;
    const height = 800;

    canvas.width = width;
    canvas.height = height;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const order = build(ctx, textColor, bgColor);
    const active: PhraseItem[] = [];
    const revealed: PhraseItem[] = [];

    let nextIndex = 0;
    let lastTime = 0;
    let accumulator = 0;
    let startTime: number | null = null;
    let heartComplete = false;
    let flickerTarget: PhraseItem | null = null;
    let nextFlickerAt = 0;

    function drawItem(
      p: PhraseItem,
      x: number,
      y: number,
      fill: string,
      size = p.size,
    ) {
      ctx.font = `bold ${size}px ${FONT}`;
      ctx.fillStyle = fill;
      ctx.fillText(p.text, x + width / 2, y + height / 2);
    }

    function spawn(p: PhraseItem) {
      p.f = 0;
      active.push(p);
    }

    function drawSettled(p: PhraseItem, overrideColor?: Vec3) {
      const x = p.x;
      const y = -p.y;
      const color = overrideColor ?? p.color;

      drawItem(p, x + 2, y + 3, hx(dim(color, 0.3)));
      drawItem(p, x, y, hx(color));
    }

    function animate(p: PhraseItem) {
      p.f = (p.f ?? 0) + 1;

      const u = clamp((p.f ?? 0) / ANIM);
      const e = 1 - (1 - u) ** 3;
      const x = p.x + p.dx * (1 - e);
      const y = -p.y - (1 - e) * LIFT;

      drawItem(p, x + 2, y + 3, hx(mix(baseBgColor, dim(p.color, 0.3), e)));
      drawItem(
        p,
        x,
        y,
        hx(mix(baseBgColor, dim(p.color, 0.2), e * e)),
        p.size + 1,
      );

      const flash = 0.75 * Math.sin(Math.PI * clamp((u - 0.55) / 0.45));
      const color = mix(mix(baseBgColor, p.color, e ** 1.5), flashColor, flash);

      drawItem(p, x, y, hx(color));

      if (u >= 1) {
        p.x = p.x;
        p.y = p.y;
        drawSettled(p);
        return false;
      }

      return true;
    }

    function render(time: number) {
      if (stopped) return;

      if (startTime === null) {
        startTime = time;
        lastTime = time;
      }

      const delta = Math.min(time - lastTime, 50);
      lastTime = time;

      ctx.fillStyle = hx(baseBgColor);
      ctx.fillRect(0, 0, width, height);

      if (!heartComplete) {
        if (nextIndex < order.length) {
          accumulator += delta * (order.length / DURATION);

          while (accumulator >= 1 && nextIndex < order.length) {
            spawn(order[nextIndex]);
            nextIndex += 1;
            accumulator -= 1;
          }
        }

        for (let i = active.length - 1; i >= 0; i--) {
          if (!animate(active[i])) {
            revealed.push(active[i]);
            active.splice(i, 1);
          }
        }

        if (nextIndex >= order.length && active.length === 0) {
          heartComplete = true;
          nextFlickerAt = time + 250;
        }
      }

      if (heartComplete) {
        if (time >= nextFlickerAt) {
          const candidates = revealed.filter((item) => item !== flickerTarget);
          const next =
            candidates[Math.floor(Math.random() * candidates.length)] ??
            flickerTarget;

          flickerTarget = next;
          nextFlickerAt = time + FLICKER_INTERVAL;
        }

        for (const item of revealed) {
          drawSettled(item, item === flickerTarget ? flickerColor : item.color);
        }
      } else {
        for (const item of revealed) {
          drawSettled(item);
        }
      }

      animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (shimmerTimeoutId !== undefined) window.clearTimeout(shimmerTimeoutId);
    };
  }, []);

  return (
    <main className="love-page">
      <div className="love-content">
        <h1 className="love-title">For My Yayayyy</h1>
        <canvas
          ref={canvasRef}
          className="love-canvas"
          aria-label="A heart made of I love you messages in different languages"
        />
      </div>
    </main>
  );
}
