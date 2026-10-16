import { sfx } from "./audio";

/* ─────────────────────────── World constants (1 unit ≈ 1 cm) ─────────────────────────── */
export const W = 1000;
export const H = 625;
export const FLOOR_Y = 540;
export const BALL_R = 15;
export const RIM_Y = 245;
const RIM_INNER = 58;
export const RIM_BACK_X = 880;
export const RIM_FRONT_X = RIM_BACK_X - RIM_INNER;
const RIM_TUBE = 5;
const BOARD_FACE_X = 889;
const BOARD_THICK = 13;
const BOARD_TOP = 143;
const BOARD_BOT = 252;
const G = 1300;
const MAX_DRAG = 300;
const BALL_START_DY = 198;

export type Mode = "time" | "free" | "streak";
export type Difficulty = "rookie" | "pro" | "legend";
export type Phase = "ready" | "flight" | "settle" | "over";
export type ShotResult = "swish" | "make" | "miss" | null;

export interface GameConfig {
  mode: Mode;
  difficulty: Difficulty;
  duration?: number;
  shotCount?: number;
}

export interface Stats {
  score: number;
  shots: number;
  makes: number;
  streak: number;
  bestStreak: number;
  combo: number;
  timeLeft: number;
  shotsLeft: number;
  phase: Phase;
  spotLabel: string;
  aiming: boolean;
  angle: number;
  power: number;
  lastResult: ShotResult;
  lastPoints: number;
  message: string;
  hot: boolean;
}

export interface Summary {
  mode: Mode;
  difficulty: Difficulty;
  score: number;
  shots: number;
  makes: number;
  bestStreak: number;
  accuracy: number;
  message: string;
}

export const MODES: Record<Mode, { name: string; tag: string; blurb: string; icon: string }> = {
  time: {
    name: "Time Attack",
    tag: "60s",
    blurb: "Sink buckets as fast as you can. Every make moves you to a new spot.",
    icon: "⏱️",
  },
  free: {
    name: "Free Throws",
    tag: "10 shots",
    blurb: "Ten shots from the stripe. Pure shooting, no clock, no excuses.",
    icon: "🎯",
  },
  streak: {
    name: "Streak Mode",
    tag: "Sudden death",
    blurb: "One miss and it's over. The hoop starts moving once you heat up.",
    icon: "🔥",
  },
};

export const DIFFICULTIES: Record<Difficulty, { name: string; blurb: string; dots: number }> = {
  rookie: { name: "Rookie", blurb: "Full aim guide · wide window", dots: 24 },
  pro: { name: "Pro", blurb: "Short aim guide", dots: 9 },
  legend: { name: "Legend", blurb: "Barely any help · moving hoop", dots: 4 },
};

export const SPOTS: { x: number; label: string; short: string }[] = [
  { x: 150, label: "LEFT BASELINE", short: "L-BASE" },
  { x: 305, label: "LEFT WING", short: "L-WING" },
  { x: 455, label: "TOP OF THE ARC", short: "TOP" },
  { x: 590, label: "RIGHT WING", short: "R-WING" },
  { x: 665, label: "RIGHT CORNER", short: "R-CORNER" },
];
const FT_SPOT = { x: 470, label: "FREE THROW LINE", short: "FT" };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  spin: number;
  rot: number;
  kind: "spark" | "confetti" | "smoke";
}

interface Pop {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  trail: { x: number; y: number }[];
  touchedRim: boolean;
  touchedBoard: boolean;
  scored: boolean;
  bounces: number;
  flightT: number;
  prevY: number;
  peak: number;
  crossX: number | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const JERSEYS = ["#e11d48", "#2563eb", "#7c3aed", "#0d9488", "#ea580c", "#db2777"];

export class BasketballGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  cfg: GameConfig;
  onStats: (s: Stats) => void;
  onOver: (s: Summary) => void;

  private raf = 0;
  private lastT = 0;
  private acc = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  paused = false;
  private destroyed = false;

  // match state
  phase: Phase = "ready";
  private clock = 0;
  private timeLeft = 60;
  private shotsLeft = 10;
  private score = 0;
  private shots = 0;
  private makes = 0;
  private streak = 0;
  private bestStreak = 0;
  private message = "";
  private msgTimer = 0;
  private lastResult: ShotResult = null;
  private lastPoints = 0;
  private spot = SPOTS[2];

  // entities
  private ball: Ball = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    trail: [],
    touchedRim: false,
    touchedBoard: false,
    scored: false,
    bounces: 0,
    flightT: 0,
    prevY: 0,
    peak: 0,
    crossX: null,
  };
  private aim = { angle: 52, power: 0.42 };
  private aiming = false;
  private keyAim = false;
  private dragStart = { x: 0, y: 0 };
  private dragCur = { x: 0, y: 0 };
  private shotT = 0;
  private pose: "hold" | "wind" | "release" | "follow" = "hold";
  private poseT = 0;
  private dribble = 0;

  private particles: Particle[] = [];
  private pops: Pop[] = [];
  private crowd: { x: number; y: number; r: number; c: string; p: number; cheer: number }[] = [];
  private netSway = 0;
  private netSwayV = 0;
  private shake = 0;
  private hoopDX = 0;
  private hoopDY = 0;
  private hoopMoving = false;
  private flash = 0;
  private jersey = JERSEYS[0];
  private r = rng(1337);
  private statsT = 0;

  constructor(
    canvas: HTMLCanvasElement,
    cfg: GameConfig,
    onStats: (s: Stats) => void,
    onOver: (s: Summary) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cfg = cfg;
    this.onStats = onStats;
    this.onOver = onOver;
    this.timeLeft = cfg.duration ?? 60;
    this.shotsLeft = cfg.shotCount ?? 10;
    this.jersey = JERSEYS[Math.floor(this.r() * JERSEYS.length)];
    this.hoopMoving = cfg.difficulty === "legend";
    this.buildCrowd();
    this.spot = cfg.mode === "free" ? FT_SPOT : SPOTS[2];
    this.resetBall();
    this.attach();
    this.resize();
    this.pushStats();
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ───────────── lifecycle ───────────── */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.detach();
  }

  private handlers: Array<[EventTarget, string, EventListener]> = [];
  private ro: ResizeObserver | null = null;
  private on<K extends string>(t: EventTarget, ev: K, fn: EventListener, opts?: AddEventListenerOptions) {
    t.addEventListener(ev, fn, opts);
    this.handlers.push([t, ev, fn]);
  }
  private detach() {
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    this.handlers = [];
    this.ro?.disconnect();
    this.ro = null;
  }

  private attach() {
    const c = this.canvas;
    this.on(window, "resize", () => this.resize());
    if (typeof ResizeObserver !== "undefined" && c.parentElement) {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(c.parentElement);
      this.ro = ro;
    }
    this.on(c, "pointerdown", (e) => {
      const p = this.toWorld(e as PointerEvent);
      if (this.phase !== "ready") return;
      this.aiming = true;
      this.keyAim = false;
      this.dragStart = p;
      this.dragCur = p;
      this.pose = "wind";
      c.setPointerCapture?.((e as PointerEvent).pointerId);
      sfx.resume();
    });
    this.on(c, "pointermove", (e) => {
      if (!this.aiming) return;
      this.dragCur = this.toWorld(e as PointerEvent);
      this.updateAimFromDrag();
    });
    const up = (e: Event) => {
      if (!this.aiming) return;
      this.dragCur = this.toWorld(e as PointerEvent);
      this.updateAimFromDrag();
      this.aiming = false;
      const dx = this.dragStart.x - this.dragCur.x;
      const dy = this.dragStart.y - this.dragCur.y;
      if (Math.hypot(dx, dy) < 18) {
        this.pose = "hold";
        return;
      }
      this.shoot();
    };
    this.on(c, "pointerup", up);
    this.on(c, "pointercancel", () => {
      this.aiming = false;
      this.pose = "hold";
    });
    this.on(c, "contextmenu", (e) => e.preventDefault());
    this.on(window, "keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) e.preventDefault();
      if (this.phase !== "ready") return;
      const step = k === "Shift" ? 3 : 1;
      if (k === "ArrowLeft") this.setKeyAim(this.aim.angle + step, this.aim.power);
      if (k === "ArrowRight") this.setKeyAim(this.aim.angle - step, this.aim.power);
      if (k === "ArrowUp") this.setKeyAim(this.aim.angle, this.aim.power + 0.02 * step);
      if (k === "ArrowDown") this.setKeyAim(this.aim.angle, this.aim.power - 0.02 * step);
      if (k === " ") this.shoot();
    });
  }

  private setKeyAim(a: number, p: number) {
    this.keyAim = true;
    this.aiming = false;
    this.aim.angle = clamp(a, 18, 80);
    this.aim.power = clamp(p, 0.05, 1);
    this.pose = "wind";
  }

  private updateAimFromDrag() {
    const dx = this.dragStart.x - this.dragCur.x;
    const dy = this.dragStart.y - this.dragCur.y;
    const len = Math.hypot(dx, dy);
    this.aim.power = clamp(len / MAX_DRAG, 0, 1);
    if (len > 6) {
      const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
      this.aim.angle = clamp(deg, 18, 80);
    }
  }

  private toWorld(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    return { x, y };
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(cw * dpr));
    this.canvas.height = Math.max(1, Math.floor(ch * dpr));
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    const s = Math.min(cw / W, ch / H);
    this.scale = s * dpr;
    this.ox = ((cw * dpr) - W * this.scale) / 2;
    this.oy = ((ch * dpr) - H * this.scale) / 2;
  }

  /* ───────────── game flow ───────────── */
  private resetBall() {
    const bx = this.spot.x + 18;
    this.ball = {
      x: bx,
      y: FLOOR_Y - BALL_START_DY,
      vx: 0,
      vy: 0,
      rot: -0.6,
      spin: 0,
      trail: [],
      touchedRim: false,
      touchedBoard: false,
      scored: false,
      bounces: 0,
      flightT: 0,
      prevY: FLOOR_Y - BALL_START_DY,
      peak: FLOOR_Y,
      crossX: null,
    };
    this.shotT = 0;
    // give the player a sensible starting aim for the new spot
    const dx = this.rimCX - (this.spot.x + 18);
    const ang = dx > 380 ? 58 : dx > 250 ? 64 : 74;
    const p = this.idealPower(ang);
    this.aim.angle = ang;
    if (p !== null) {
      // start close to (but not exactly on) the sweet spot so every shot still takes skill
      const jitter = 0.035 + ["rookie", "pro", "legend"].indexOf(this.cfg.difficulty) * 0.02;
      this.aim.power = clamp(p + (this.r() - 0.5) * 2 * jitter, 0.05, 1);
    }
  }

  private shoot() {
    if (this.phase !== "ready") return;
    const a = (this.aim.angle * Math.PI) / 180;
    const v = 500 + this.aim.power * 1100;
    this.ball.vx = Math.cos(a) * v;
    this.ball.vy = -Math.sin(a) * v;
    this.ball.spin = -7 - this.aim.power * 6;
    this.phase = "flight";
    this.aiming = false;
    this.keyAim = false;
    this.pose = "release";
    this.poseT = 0;
    this.shotT = 0;
    this.message = "";
    sfx.play("whoosh", 0.6 + this.aim.power * 0.4);
    this.pushStats();
  }

  private get rimCX() {
    return RIM_FRONT_X + RIM_INNER / 2 + this.hoopDX;
  }
  private get rimFrontX() {
    return RIM_FRONT_X + this.hoopDX;
  }
  private get rimBackX() {
    return RIM_BACK_X + this.hoopDX;
  }
  private get rimY() {
    return RIM_Y + this.hoopDY;
  }

  private endShot(scored: boolean) {
    this.phase = "settle";
    this.shotT = 0;
    this.shots++;
    const swish = scored && !this.ball.touchedRim && !this.ball.touchedBoard;
    const dist = Math.abs(this.rimCX - this.spot.x);
    const three = dist >= 500;
    if (scored) {
      this.makes++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const mult = this.comboMult;
      const base = three ? 3 : 2;
      const bonus = swish ? 1 : 0;
      this.lastPoints = (base + bonus) * mult;
      this.score += this.lastPoints;
      this.lastResult = swish ? "swish" : "make";
      this.say(
        `${swish ? "SWISH!" : three ? "THREE!" : "BUCKET"} +${this.lastPoints}${
          mult > 1 ? ` ×${mult}` : ""
        }`,
      );
      this.celebrate(swish);
      sfx.play("score");
      sfx.play("swish", swish ? 1 : 0.7);
      sfx.play("cheer", swish ? 1 : 0.7);
    } else {
      this.streak = 0;
      this.lastPoints = 0;
      this.lastResult = "miss";
      this.say(this.missText());
      sfx.play("miss", 0.7);
    }
    if (this.cfg.mode === "free") this.shotsLeft = Math.max(0, this.shotsLeft - 1);
    if (this.cfg.mode === "streak" && this.streak >= 4) this.hoopMoving = true;
    this.pushStats();
  }

  private missText() {
    const b = this.ball;
    const cx = b.crossX;
    if (cx === null) {
      if (b.touchedBoard) return "OFF THE GLASS — NO GOOD";
      return b.peak > this.rimY - 24 ? "SHORT — NEVER GOT THERE" : "AIRBALL";
    }
    if (cx < this.rimFrontX)
      return b.touchedRim ? "FRONT IRON — SHORT" : "SHORT OF THE RIM";
    if (cx > this.rimBackX)
      return b.touchedBoard ? "TOO STRONG — OFF THE GLASS" : "TOO STRONG";
    return "RATTLED OUT!";
  }

  private get comboMult() {
    return 1 + Math.min(3, Math.floor(Math.max(0, this.streak) / 2));
  }

  /** Speed needed at the current angle to drop the ball through the middle of the rim. */
  private idealPower(angleDeg = this.aim.angle): number | null {
    const a = (angleDeg * Math.PI) / 180;
    const dx = this.rimCX - (this.spot.x + 18);
    const dyUp = FLOOR_Y - BALL_START_DY - this.rimY; // rim height above the release point
    const denom = 2 * Math.cos(a) * Math.cos(a) * (dx * Math.tan(a) - dyUp);
    if (denom <= 0 || dx <= 0) return null;
    const v = Math.sqrt((G * dx * dx) / denom);
    const p = (v - 500) / 1100;
    if (p < 0 || p > 1) return null;
    return p;
  }

  private say(m: string) {
    this.message = m;
    this.msgTimer = 1.7;
  }

  private nextShot() {
    if (this.cfg.mode === "free") {
      this.spot = FT_SPOT;
    } else {
      let i = Math.floor(this.r() * SPOTS.length);
      if (SPOTS[i].x === this.spot.x) i = (i + 1 + Math.floor(this.r() * 3)) % SPOTS.length;
      this.spot = SPOTS[i];
    }
    this.resetBall();
    this.phase = "ready";
    this.pose = "hold";
    this.lastResult = null;
    this.pushStats();
  }

  private finish() {
    if (this.phase === "over") return;
    this.phase = "over";
    sfx.play("buzzer");
    sfx.play("cheer", 0.6);
    this.onOver({
      mode: this.cfg.mode,
      difficulty: this.cfg.difficulty,
      score: this.score,
      shots: this.shots,
      makes: this.makes,
      bestStreak: this.bestStreak,
      accuracy: this.shots ? Math.round((this.makes / this.shots) * 100) : 0,
      message:
        this.cfg.mode === "streak"
          ? `${this.bestStreak} in a row`
          : this.makes === this.shots && this.shots > 0
            ? "PERFECT GAME"
            : "",
    });
    this.pushStats();
  }

  /* ───────────── simulation ───────────── */
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;
    if (!this.paused && this.phase !== "over") {
      this.acc += dt;
      const step = 1 / 120;
      let guard = 0;
      while (this.acc >= step && guard++ < 12) {
        this.update(step);
        this.acc -= step;
      }
    }
    this.updateFx(dt);
    this.render();
    this.statsT += dt;
    if (this.statsT > 0.1) {
      this.statsT = 0;
      this.pushStats();
    }
  };

  private update(dt: number) {
    this.clock += dt;
    if (this.cfg.mode === "time" && this.phase !== "over") {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0 && this.phase !== "flight") {
        this.finish();
        return;
      }
      if (this.timeLeft <= 0) {
        // let the in-flight ball count if it drops before the buzzer beater window closes
        this.timeLeft = 0;
      }
    }
    if (this.hoopMoving) {
      this.hoopDX = Math.sin(this.clock * 0.55) * 55;
      this.hoopDY = Math.sin(this.clock * 0.9 + 1.2) * 34;
    } else {
      this.hoopDX = lerp(this.hoopDX, 0, 0.08);
      this.hoopDY = lerp(this.hoopDY, 0, 0.08);
    }
    this.dribble += dt;

    if (this.phase === "ready") {
      const bob = Math.sin(this.clock * 4) * 1;
      this.ball.y = FLOOR_Y - BALL_START_DY + bob;
      this.ball.x = this.spot.x + 18;
      this.ball.rot += dt * 0.5;
    }

    if (this.phase === "flight" || this.phase === "settle") {
      this.shotT += dt;
      const sub = dt / 2;
      for (let k = 0; k < 2; k++) this.physics(sub);
    }

    if (this.phase === "flight") {
      this.ball.flightT += dt;
      const b = this.ball;
      const slow = Math.abs(b.vx) < 45 && Math.abs(b.vy) < 45 && b.y > FLOOR_Y - BALL_R * 2;
      if (b.scored && this.shotT > 0.5) this.endShot(true);
      else if (slow || this.shotT > 6 || b.x < -60 || b.x > W + 60) this.endShot(false);
    } else if (this.phase === "settle") {
      if (this.shotT > 0.45) {
        if (this.cfg.mode === "free" && this.shotsLeft <= 0) this.finish();
        else if (this.cfg.mode === "streak" && this.streak === 0 && this.shots > 0) this.finish();
        else if (this.cfg.mode === "time" && this.timeLeft <= 0) this.finish();
        else this.nextShot();
      }
    }

    // pose timeline
    this.poseT += dt;
    if (this.pose === "release" && this.poseT > 0.12) {
      this.pose = "follow";
      this.poseT = 0;
    } else if (this.pose === "follow" && this.poseT > 0.5 && this.phase !== "ready") {
      this.pose = "hold";
      this.poseT = 0;
    }
    if (this.msgTimer > 0) this.msgTimer -= dt;
    this.netSwayV += -this.netSway * 90 * dt - this.netSwayV * 6 * dt;
    this.netSway += this.netSwayV * dt;
  }

  private physics(dt: number) {
    const b = this.ball;
    b.prevY = b.y;
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.spin * dt;
    if (b.y < b.peak) b.peak = b.y;

    if (!b.scored && this.phase === "flight") {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 64) b.trail.shift();
    }

    const rimY = this.rimY;
    // scoring: ball centre passes down through the rim plane inside the hoop
    if (b.prevY <= rimY && b.y > rimY && b.vy > 0) {
      if (b.crossX === null) b.crossX = b.x;
      if (!b.scored && b.x > this.rimFrontX - 2 && b.x < this.rimBackX + 4) {
        b.scored = true;
        this.netSwayV += b.vx * 0.55;
        this.flash = 0.6;
      }
    }

    // backboard
    const bx0 = BOARD_FACE_X + this.hoopDX;
    if (
      b.x + BALL_R > bx0 &&
      b.x - BALL_R < bx0 + BOARD_THICK &&
      b.y + BALL_R > BOARD_TOP + this.hoopDY &&
      b.y - BALL_R < BOARD_BOT + this.hoopDY
    ) {
      const overlapRight = b.x + BALL_R - bx0;
      const overlapLeft = bx0 + BOARD_THICK - (b.x - BALL_R);
      if (overlapRight < overlapLeft) {
        b.x = bx0 - BALL_R;
        if (b.vx > 0) {
          b.vx = -b.vx * 0.66;
          b.vy *= 0.94;
          this.hitBoard();
        }
      } else {
        b.x = bx0 + BOARD_THICK + BALL_R;
        if (b.vx < 0) {
          b.vx = -b.vx * 0.66;
          this.hitBoard();
        }
      }
      b.spin *= 0.5;
    }

    // rim tubes (two circles)
    for (const rx of [this.rimFrontX, this.rimBackX]) {
      const dx = b.x - rx;
      const dy = b.y - rimY;
      const rr = BALL_R + RIM_TUBE;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.max(0.001, Math.sqrt(d2));
        const nx = dx / d;
        const ny = dy / d;
        b.x = rx + nx * rr;
        b.y = rimY + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + 0.55) * vn * nx;
          b.vy -= (1 + 0.55) * vn * ny;
          const tx = -ny;
          const ty = nx;
          const vt = b.vx * tx + b.vy * ty;
          b.vx -= vt * 0.22 * tx;
          b.vy -= vt * 0.22 * ty;
          b.spin = -vt * 0.12;
          sfx.play("rim", clamp(-vn / 900, 0.15, 1));
          this.shake = Math.max(this.shake, clamp(-vn / 60, 2, 9));
          for (let i = 0; i < 6; i++) this.spark(b.x, b.y, "#fbbf24");
        }
        b.touchedRim = true;
      }
    }

    // floor
    if (b.y + BALL_R > FLOOR_Y) {
      b.y = FLOOR_Y - BALL_R;
      if (b.vy > 20) {
        sfx.play("bounce", clamp(b.vy / 700, 0.1, 1));
        for (let i = 0; i < 4; i++) this.spark(b.x, FLOOR_Y - 2, "#d4a373");
      }
      b.vy = -b.vy * 0.6;
      b.vx *= 0.965;
      b.spin = b.spin * 0.6 + b.vx * 0.05;
      if (Math.abs(b.vy) < 25) b.vy = 0;
      b.bounces++;
    }
    // support pole
    if (b.x + BALL_R > W - 32 && b.vx > 0 && b.y > 150) {
      b.x = W - 32 - BALL_R;
      b.vx = -b.vx * 0.6;
      sfx.play("board", 0.5);
    }
    // side walls
    if (b.x - BALL_R < 6 && b.vx < 0) {
      b.x = 6 + BALL_R;
      b.vx = -b.vx * 0.7;
    }
    if (b.x + BALL_R > W - 6 && b.vx > 0) {
      b.x = W - 6 - BALL_R;
      b.vx = -b.vx * 0.7;
    }
  }

  private hitBoard() {
    this.ball.touchedBoard = true;
    sfx.play("board", 0.9);
    this.shake = Math.max(this.shake, 7);
    for (let i = 0; i < 10; i++) this.spark(this.ball.x + BALL_R, this.ball.y, "#e2e8f0");
  }

  /* ───────────── effects ───────────── */
  private spark(x: number, y: number, color: string) {
    const a = this.r() * Math.PI * 2;
    const s = 40 + this.r() * 180;
    this.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.35 + this.r() * 0.3,
      max: 0.65,
      size: 1.5 + this.r() * 2.5,
      color,
      grav: 700,
      spin: 0,
      rot: 0,
      kind: "spark",
    });
  }

  private celebrate(swish: boolean) {
    const cx = this.rimCX;
    const cy = this.rimY;
    for (let i = 0; i < (swish ? 46 : 26); i++) {
      const a = -Math.PI / 2 + (this.r() - 0.5) * 2.4;
      const s = 120 + this.r() * 420;
      this.particles.push({
        x: cx,
        y: cy + 10,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + this.r() * 0.7,
        max: 1.3,
        size: 2 + this.r() * 3,
        color: ["#fbbf24", "#f97316", "#fde68a", "#ffffff", "#22d3ee"][Math.floor(this.r() * 5)],
        grav: 620,
        spin: (this.r() - 0.5) * 16,
        rot: this.r() * 6,
        kind: this.r() < 0.45 ? "confetti" : "spark",
      });
    }
    this.pops.push({
      x: cx - 10,
      y: cy - 55,
      vy: -55,
      life: 1.4,
      text: swish ? "SWISH!" : "BUCKET!",
      color: swish ? "#fde047" : "#f97316",
      size: 34,
    });
    if (this.comboMult > 1) {
      this.pops.push({
        x: this.spot.x,
        y: FLOOR_Y - 250,
        vy: -40,
        life: 1.2,
        text: `ON FIRE ×${this.comboMult}`,
        color: "#fb7185",
        size: 22,
      });
    }
    for (const c of this.crowd) c.cheer = Math.min(1, c.cheer + 0.9 * this.r());
    this.shake = Math.max(this.shake, swish ? 10 : 6);
  }

  private updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.y > FLOOR_Y - 2) {
        p.y = FLOOR_Y - 2;
        p.vy *= -0.35;
        p.vx *= 0.7;
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= 1 - 1.1 * dt;
      if (p.life <= 0) this.pops.splice(i, 1);
    }
    this.shake *= 1 - 6 * dt;
    this.flash *= 1 - 5 * dt;
    for (const c of this.crowd) c.cheer *= 1 - 1.6 * dt;
    // hot streak ball flame
    if (this.streak >= 3 && this.phase === "flight" && this.r() < 0.7) {
      this.particles.push({
        x: this.ball.x + (this.r() - 0.5) * 10,
        y: this.ball.y + (this.r() - 0.5) * 10,
        vx: -this.ball.vx * 0.06,
        vy: -this.ball.vy * 0.06,
        life: 0.3,
        max: 0.3,
        size: 4 + this.r() * 6,
        color: this.r() < 0.5 ? "#fb923c" : "#fde047",
        grav: -80,
        spin: 0,
        rot: 0,
        kind: "smoke",
      });
    }
  }

  private buildCrowd() {
    const r = rng(99);
    const colors = ["#f43f5e", "#38bdf8", "#a3e635", "#fbbf24", "#c084fc", "#f8fafc", "#fb923c", "#64748b"];
    for (let row = 0; row < 5; row++) {
      const y = 150 + row * 30;
      const n = 46 + row * 5;
      for (let i = 0; i < n; i++) {
        this.crowd.push({
          x: (i / n) * (W + 40) - 20 + (r() - 0.5) * 12,
          y: y + (r() - 0.5) * 8,
          r: 5 + r() * 3.5,
          c: colors[Math.floor(r() * colors.length)],
          p: r() * Math.PI * 2,
          cheer: 0,
        });
      }
    }
  }

  private pushStats() {
    this.onStats({
      score: this.score,
      shots: this.shots,
      makes: this.makes,
      streak: this.streak,
      bestStreak: this.bestStreak,
      combo: this.comboMult,
      timeLeft: this.timeLeft,
      shotsLeft: this.shotsLeft,
      phase: this.phase,
      spotLabel: `${this.spot.label} · ${Math.abs(this.rimCX - this.spot.x) >= 500 ? "3PTS" : "2PTS"}`,
      aiming: this.aiming || this.keyAim,
      angle: this.aim.angle,
      power: this.aim.power,
      lastResult: this.lastResult,
      lastPoints: this.lastPoints,
      message: this.msgTimer > 0 ? this.message : "",
      hot: this.streak >= 3,
    });
  }

  /* ───────────── rendering ───────────── */
  private render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.shake > 0.3 ? (this.r() - 0.5) * this.shake : 0;
    const sy = this.shake > 0.3 ? (this.r() - 0.5) * this.shake : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    this.drawArena(ctx);
    this.drawCrowd(ctx);
    this.drawCourtBack(ctx);
    this.drawFloor(ctx);
    this.drawHoop(ctx, true);
    this.drawPlayer(ctx);
    this.drawBallTrail(ctx);
    this.drawBall(ctx);
    this.drawHoop(ctx, false);
    this.drawAim(ctx);
    this.drawParticles(ctx);
    this.drawPops(ctx);
    this.drawOverlays(ctx);
  }

  private drawArena(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#080d1c");
    g.addColorStop(0.45, "#0d1730");
    g.addColorStop(0.72, "#111d3a");
    g.addColorStop(1, "#0a1224");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // spotlights
    for (const lx of [170, 500, 830]) {
      const rg = ctx.createRadialGradient(lx, -60, 10, lx, 260, 460);
      rg.addColorStop(0, "rgba(255,246,214,0.20)");
      rg.addColorStop(0.5, "rgba(255,246,214,0.05)");
      rg.addColorStop(1, "rgba(255,246,214,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(lx - 30, -20);
      ctx.lineTo(lx + 30, -20);
      ctx.lineTo(lx + 330, FLOOR_Y);
      ctx.lineTo(lx - 330, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
    }
    // banner row
    ctx.fillStyle = "rgba(148,163,184,0.10)";
    ctx.fillRect(0, 118, W, 26);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "rgba(248,113,113,0.16)" : "rgba(56,189,248,0.14)";
      ctx.fillRect(30 + i * 122, 122, 96, 18);
      ctx.fillStyle = "rgba(226,232,240,0.16)";
      ctx.fillRect(38 + i * 122, 126, 60, 4);
      ctx.fillRect(38 + i * 122, 133, 36, 3);
    }
  }

  private drawCrowd(ctx: CanvasRenderingContext2D) {
    const t = this.clock;
    for (const c of this.crowd) {
      const jump = Math.max(0, Math.sin(t * 3 + c.p) * 2 + c.cheer * 9);
      ctx.fillStyle = c.c;
      ctx.globalAlpha = 0.5 + c.cheer * 0.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y - jump, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35 + c.cheer * 0.4;
      ctx.fillRect(c.x - c.r * 1.1, c.y - jump + c.r * 0.6, c.r * 2.2, c.r * 1.6);
    }
    ctx.globalAlpha = 1;
    // courtside LED ad ribbon
    const rg = ctx.createLinearGradient(0, 300, 0, 336);
    rg.addColorStop(0, "#0b1224");
    rg.addColorStop(1, "#131f3c");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 300, W, 36);
    ctx.fillStyle = "rgba(248,250,252,0.9)";
    ctx.fillRect(0, 300, W, 2);
    const ads = ["HOOP LEGENDS", "★ COURTSIDE ★", "SWISH CLUB", "3PT KING", "NIGHT SESSION"];
    for (let i = 0; i < 5; i++) {
      const x = i * 205;
      const on = Math.floor(this.clock * 1.2) % 5 === i;
      ctx.fillStyle = on ? "rgba(249,115,22,0.9)" : "rgba(30,41,59,0.9)";
      ctx.fillRect(x + 6, 306, 193, 24);
      ctx.fillStyle = on ? "#0b1224" : "rgba(148,163,184,0.75)";
      ctx.font = "900 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ads[i], x + 102, 324);
    }
  }

  /** Far side of the hardwood, drawn in fake perspective between the crowd and the near baseline. */
  private drawCourtBack(ctx: CanvasRenderingContext2D) {
    const top = 336;
    const bot = FLOOR_Y;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#6b4523");
    g.addColorStop(0.55, "#8d5c2d");
    g.addColorStop(1, "#b0713a");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, bot - top);

    const persp = (x: number, f: number) => W / 2 + (x - W / 2) * f;
    // horizontal boards (denser near the far sideline)
    ctx.strokeStyle = "rgba(45,24,8,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const f = i / 13;
      const y = top + Math.pow(f, 1.7) * (bot - top);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // vertical seams converging to a vanishing point
    for (let i = -8; i <= 8; i++) {
      const x0 = W / 2 + i * 130;
      ctx.beginPath();
      ctx.moveTo(persp(x0, 0.35), top);
      ctx.lineTo(persp(x0, 1.15), bot);
      ctx.stroke();
    }
    // painted key under the basket
    const hoopX = this.rimCX;
    ctx.fillStyle = "rgba(120,53,15,0.55)";
    ctx.beginPath();
    ctx.moveTo(hoopX, bot);
    ctx.lineTo(persp(hoopX - 20, 0.55), top);
    ctx.lineTo(persp(hoopX - 430, 0.55), top);
    ctx.lineTo(hoopX - 430, bot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(248,250,252,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // free-throw circle
    ctx.beginPath();
    ctx.ellipse(persp(hoopX - 215, 0.62), top + (bot - top) * 0.42, 74 * 0.62, 40, 0, 0, Math.PI * 2);
    ctx.stroke();
    // three point arc
    ctx.beginPath();
    ctx.moveTo(persp(hoopX - 520, 0.5), top + 2);
    ctx.quadraticCurveTo(
      persp(hoopX - 250, 0.5),
      bot - 6,
      persp(hoopX - 60, 0.95),
      bot - 2,
    );
    ctx.stroke();
    // shadow under the hoop
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(hoopX + 20, bot - 2, 110, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFloor(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    g.addColorStop(0, "#c88a4e");
    g.addColorStop(0.35, "#b0713a");
    g.addColorStop(1, "#7a4a22");
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    // planks
    ctx.strokeStyle = "rgba(60,30,10,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const y = FLOOR_Y + (i / 22) * (H - FLOOR_Y) * 1.5;
      if (y > H) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -6; i < 16; i++) {
      const xTop = i * 120;
      const xBot = W / 2 + (xTop - W / 2) * 2.0;
      ctx.beginPath();
      ctx.moveTo(xTop, FLOOR_Y);
      ctx.lineTo(xBot, H);
      ctx.stroke();
    }
    // baseline + gloss
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, FLOOR_Y - 4, W, 4);
    const gl = ctx.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 60);
    gl.addColorStop(0, "rgba(255,255,255,0.28)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(0, FLOOR_Y, W, 60);
    // key / paint markings in perspective
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    const keyX0 = 640;
    const keyX1 = 940;
    ctx.beginPath();
    ctx.moveTo(keyX0, FLOOR_Y);
    ctx.lineTo(keyX0 + (keyX0 - W / 2) * 0.55, H);
    ctx.moveTo(keyX1, FLOOR_Y);
    ctx.lineTo(keyX1 + (keyX1 - W / 2) * 0.55, H);
    ctx.stroke();
    ctx.restore();
  }

  private drawHoop(ctx: CanvasRenderingContext2D, back: boolean) {
    const dx = this.hoopDX;
    const dy = this.hoopDY;
    const rimY = this.rimY;
    if (back) {
      // support pole + arm
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(W - 26, FLOOR_Y);
      ctx.lineTo(W - 26, 130);
      ctx.stroke();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(W - 26, 168);
      ctx.lineTo(BOARD_FACE_X + BOARD_THICK + dx, 190 + dy);
      ctx.stroke();
      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.beginPath();
      ctx.ellipse(W - 26, FLOOR_Y + 6, 46, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // backboard
      const bx = BOARD_FACE_X + dx;
      const bg = ctx.createLinearGradient(bx, BOARD_TOP + dy, bx + BOARD_THICK, BOARD_BOT + dy);
      bg.addColorStop(0, "rgba(241,245,249,0.95)");
      bg.addColorStop(0.5, "rgba(203,213,225,0.8)");
      bg.addColorStop(1, "rgba(148,163,184,0.85)");
      ctx.fillStyle = bg;
      ctx.fillRect(bx, BOARD_TOP + dy, BOARD_THICK, BOARD_BOT - BOARD_TOP);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, BOARD_TOP + dy, BOARD_THICK, BOARD_BOT - BOARD_TOP);
      // rim bracket
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bx, rimY);
      ctx.lineTo(this.rimBackX, rimY);
      ctx.stroke();
      return;
    }
    // net
    const sway = clamp(this.netSway, -30, 30);
    const topY = rimY;
    const botY = rimY + 62 + Math.min(18, Math.abs(sway) * 0.5);
    const topL = this.rimFrontX;
    const topR = this.rimBackX;
    const botC = (topL + topR) / 2 + sway;
    const botHalf = 22;
    ctx.strokeStyle = "rgba(248,250,252,0.85)";
    ctx.lineWidth = 1.6;
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const tx = lerp(topL, topR, f);
      const bx2 = lerp(botC - botHalf, botC + botHalf, f);
      const bend = sway * 0.35;
      ctx.beginPath();
      ctx.moveTo(tx, topY);
      ctx.quadraticCurveTo(lerp(tx, bx2, 0.5) + bend, lerp(topY, botY, 0.55), bx2, botY);
      ctx.stroke();
    }
    for (let j = 1; j <= 4; j++) {
      const f = j / 5;
      const y = lerp(topY, botY, f);
      const half = lerp((topR - topL) / 2, botHalf, f);
      const cx = lerp((topL + topR) / 2, botC, f);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.quadraticCurveTo(cx, y + 6, cx + half, y);
      ctx.stroke();
    }
    // rim tube
    const rg = ctx.createLinearGradient(0, rimY - 6, 0, rimY + 6);
    rg.addColorStop(0, "#fdba74");
    rg.addColorStop(0.45, "#f97316");
    rg.addColorStop(1, "#9a3412");
    ctx.strokeStyle = rg;
    ctx.lineWidth = RIM_TUBE * 2;
    ctx.beginPath();
    ctx.moveTo(this.rimFrontX, rimY);
    ctx.lineTo(this.rimBackX, rimY);
    ctx.stroke();
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.arc(this.rimFrontX, rimY, RIM_TUBE + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.rimBackX, rimY, RIM_TUBE + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const px = this.spot.x;
    const py = FLOOR_Y;
    const t = this.clock;
    const skin = "#c98a5f";
    const dark = "#0b1220";
    const bob = this.phase === "ready" ? Math.sin(t * 4) * 2 : 0;
    const hipY = py - 92 + bob;
    const shY = py - 158 + bob;
    const headY = py - 178 + bob;
    const knee = this.pose === "wind" ? 10 : this.pose === "release" ? -4 : 0;

    ctx.save();
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(px + 4, py + 5, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const stroke = (color: string, w: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
    };

    // legs
    stroke(dark, 15);
    ctx.beginPath();
    ctx.moveTo(px - 6, hipY);
    ctx.lineTo(px - 20 + knee, py - 46);
    ctx.lineTo(px - 18, py - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 8, hipY);
    ctx.lineTo(px + 24 - knee, py - 46);
    ctx.lineTo(px + 26, py - 4);
    ctx.stroke();
    // shoes
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(px - 20, py - 2, 13, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(px + 26, py - 2, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // torso (jersey)
    const jg = ctx.createLinearGradient(px - 20, shY, px + 20, hipY);
    jg.addColorStop(0, this.jersey);
    jg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = this.jersey;
    ctx.beginPath();
    ctx.moveTo(px - 20, shY);
    ctx.quadraticCurveTo(px, shY - 8, px + 20, shY);
    ctx.lineTo(px + 16, hipY + 4);
    ctx.lineTo(px - 16, hipY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = jg;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    // shorts
    ctx.fillStyle = dark;
    ctx.fillRect(px - 17, hipY - 4, 34, 26);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("23", px, shY + 26);

    // arms — pose driven
    const sxL = px - 14;
    const sxR = px + 14;
    const ballX = this.phase === "ready" ? this.ball.x : px + 18;
    const ballY = this.phase === "ready" ? this.ball.y : py - BALL_START_DY - 26;
    let handL = { x: ballX - 12, y: ballY + 12 };
    let handR = { x: ballX + 10, y: ballY + 8 };
    if (this.pose === "wind") {
      handL = { x: px - 2, y: py - 176 };
      handR = { x: px + 20, y: py - 186 };
    } else if (this.pose === "release" || this.pose === "follow") {
      const ext = this.pose === "release" ? 1 : 0.72;
      handL = { x: px + 10 + 8 * ext, y: py - 200 - 12 * ext };
      handR = { x: px + 26 + 10 * ext, y: py - 196 - 16 * ext };
    }
    stroke(skin, 11);
    ctx.beginPath();
    ctx.moveTo(sxL, shY + 4);
    ctx.quadraticCurveTo(px - 22, lerp(shY, handL.y, 0.5), handL.x, handL.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sxR, shY + 4);
    ctx.quadraticCurveTo(px + 26, lerp(shY, handR.y, 0.5), handR.x, handR.y);
    ctx.stroke();

    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(px + 2, headY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(px + 2, headY - 3, 15, Math.PI * 1.05, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = this.jersey;
    ctx.fillRect(px - 13, headY - 6, 30, 5);
    ctx.restore();
  }

  private drawBallTrail(ctx: CanvasRenderingContext2D) {
    const b = this.ball;
    if (b.trail.length < 3) return;
    for (let i = 0; i < b.trail.length; i++) {
      const f = i / b.trail.length;
      const p = b.trail[i];
      ctx.globalAlpha = f * 0.4;
      ctx.fillStyle = this.streak >= 3 ? "#fb923c" : "#fdba74";
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * f * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawBall(ctx: CanvasRenderingContext2D) {
    const b = this.ball;
    if (b.scored && this.phase === "ready") return;
    ctx.save();
    // keep the ball visible when it sails above the top of the frame
    ctx.translate(b.x, Math.max(b.y, 12));
    ctx.rotate(b.rot);
    const g = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.4, 2, 0, 0, BALL_R * 1.15);
    g.addColorStop(0, "#fca963");
    g.addColorStop(0.45, "#f0761c");
    g.addColorStop(1, "#a83c07");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,20,4,0.85)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.moveTo(-BALL_R, 0);
    ctx.lineTo(BALL_R, 0);
    ctx.moveTo(0, -BALL_R);
    ctx.lineTo(0, BALL_R);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, BALL_R * 0.62, BALL_R, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, BALL_R, BALL_R * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.ellipse(-BALL_R * 0.35, -BALL_R * 0.42, BALL_R * 0.3, BALL_R * 0.18, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Predicted arc drawn while aiming. */
  private aimPath(): { pts: { x: number; y: number }[]; v: number } {
    const a = (this.aim.angle * Math.PI) / 180;
    const v = 500 + this.aim.power * 1100;
    let x = this.ball.x;
    let y = this.ball.y;
    let vx = Math.cos(a) * v;
    let vy = -Math.sin(a) * v;
    const dt = 1 / 90;
    const max = DIFFICULTIES[this.cfg.difficulty].dots;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 190; i++) {
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      if (i % 7 === 0) pts.push({ x, y });
      if (y > FLOOR_Y - BALL_R || x > BOARD_FACE_X + this.hoopDX) break;
      if (pts.length >= max) break;
    }
    return { pts, v };
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    if (this.phase !== "ready") return;
    const showArc = this.aiming || this.keyAim || this.cfg.difficulty === "rookie";
    const ideal = this.idealPower();
    const locked = ideal !== null && Math.abs(ideal - this.aim.power) < 0.035;
    const { pts } = showArc ? this.aimPath() : { pts: [] };
    for (let i = 0; i < pts.length; i++) {
      const f = 1 - i / pts.length;
      ctx.globalAlpha = 0.16 + f * 0.65;
      ctx.fillStyle = locked ? "#4ade80" : this.streak >= 3 ? "#fde047" : "#a5f3fc";
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 3.4 - i * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    if (showArc && locked) {
      ctx.fillStyle = "rgba(74,222,128,0.95)";
      ctx.fillText("PERFECT ARC", this.ball.x + 22, this.ball.y - 26);
    } else if (showArc && ideal === null) {
      ctx.fillStyle = "rgba(248,113,113,0.95)";
      ctx.fillText("NEED MORE ARC", this.ball.x + 22, this.ball.y - 26);
    } else if (showArc && ideal !== null && Math.abs(ideal - this.aim.power) < 0.12) {
      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.fillText(this.aim.power > ideal ? "A LITTLE STRONG" : "A LITTLE SHORT", this.ball.x + 22, this.ball.y - 26);
    }
    // pull-back indicator while dragging
    if (this.aiming) {
      ctx.save();
      ctx.strokeStyle = "rgba(248,250,252,0.5)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.dragStart.x, this.dragStart.y);
      ctx.lineTo(this.dragCur.x, this.dragCur.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = this.aim.power > 0.85 ? "#f87171" : this.aim.power > 0.5 ? "#fbbf24" : "#4ade80";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.dragStart.x, this.dragStart.y, 16, 0, Math.PI * 2 * this.aim.power);
      ctx.stroke();
      ctx.restore();
    }
    // angle + power readout (fixed HUD panel, bottom left)
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.62)";
    const bx = 16;
    const by = H - 62;
    ctx.fillRect(bx, by, 112, 48);
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, 100, 46);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.round(this.aim.angle)}°`, bx + 9, by + 17);
    ctx.fillText(`${Math.round(this.aim.power * 100)}`, bx + 68, by + 17);
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.fillText("ANGLE", bx + 9, by + 30);
    ctx.fillText("POWER", bx + 60, by + 30);
    ctx.fillStyle = locked ? "rgba(74,222,128,0.95)" : "rgba(56,189,248,0.9)";
    ctx.fillRect(bx + 9, by + 38, 94 * this.aim.power, 4);
    if (ideal !== null) {
      ctx.fillStyle = "rgba(248,250,252,0.95)";
      ctx.fillRect(bx + 9 + 94 * ideal - 1, by + 35, 2, 10);
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === "smoke") {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawPops(ctx: CanvasRenderingContext2D) {
    for (const p of this.pops) {
      const a = clamp(p.life / 0.9, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `900 ${p.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(2,6,23,0.85)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawOverlays(ctx: CanvasRenderingContext2D) {
    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
    // vignette
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (this.cfg.mode === "time" && this.timeLeft < 10 && this.phase !== "over") {
      const pulse = 0.35 + Math.abs(Math.sin(this.clock * 6)) * 0.35;
      ctx.fillStyle = `rgba(239,68,68,${pulse * 0.13})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.phase === "ready" && this.shots === 0) {
      ctx.fillStyle = "rgba(226,232,240,0.75)";
      ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "DRAG BACK & RELEASE  ·  OR  ← → ANGLE  ↑↓ POWER  SPACE SHOOT",
        W / 2,
        FLOOR_Y - 250,
      );
    }
  }
}
