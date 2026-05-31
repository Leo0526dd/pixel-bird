"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameStatus = "ready" | "playing" | "paused" | "ended";
type BirdKind = "chick" | "owl" | "parrot";
type PaletteId = "sunny" | "berry" | "mint" | "sky";
type WeatherMode = "clear" | "cloudy" | "rainy" | "snowy" | "windy";

type WeatherState = {
  current: WeatherMode;
  next: WeatherMode;
  blend: number;
};

type MechanismKind = "gear" | "spinner" | "spark";

type Mechanism = {
  kind: MechanismKind;
  offsetY: number;
};

type Pipe = {
  x: number;
  gapY: number;
  passed: boolean;
  scoreValue: number;
  mechanism?: Mechanism;
};

type BirdPalette = {
  id: PaletteId;
  name: string;
  body: string;
  belly: string;
  wing: string;
  beak: string;
  shadow: string;
};

type BirdSkin = {
  kind: BirdKind;
  palette: BirdPalette;
};

type AmbientSound = {
  rainGain: GainNode;
  windGain: GainNode;
  rainFilter: BiquadFilterNode;
  windFilter: BiquadFilterNode;
  rainSource: AudioBufferSourceNode;
  windSource: AudioBufferSourceNode;
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const gameWidth = 432;
const gameHeight = 640;
const birdX = 118;
const birdSize = 34;
const pipeWidth = 66;
const pipeGap = 168;
const gravity = 0.42;
const flapPower = -7.4;
const pipeSpeed = 2.45;
const pipeSpacing = 228;
const groundHeight = 86;
const weatherCycle: WeatherMode[] = ["clear", "cloudy", "rainy", "windy", "snowy"];
const weatherDurationFrames = 1800;
const weatherBlendFrames = 520;

const birdKinds: Array<{ id: BirdKind; name: string }> = [
  { id: "chick", name: "小鸡" },
  { id: "owl", name: "夜枭" },
  { id: "parrot", name: "鹦鹉" }
];

const palettes: BirdPalette[] = [
  { id: "sunny", name: "阳光", body: "#f6c65b", belly: "#ffe68c", wing: "#dd7b2f", beak: "#f07f2f", shadow: "#9a4b1d" },
  { id: "berry", name: "莓果", body: "#e85b7d", belly: "#ffd1dc", wing: "#9e3b7a", beak: "#ff9a35", shadow: "#6a2146" },
  { id: "mint", name: "薄荷", body: "#58cfa6", belly: "#d6fff2", wing: "#2d917c", beak: "#ffc34d", shadow: "#226558" },
  { id: "sky", name: "蓝天", body: "#54a7f7", belly: "#d8f1ff", wing: "#2e68c9", beak: "#ffb24a", shadow: "#224386" }
];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<GameStatus>("ready");
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const birdYRef = useRef(236);
  const velocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameRef = useRef(0);
  const npcCheerFrameRef = useRef(-999);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientSoundRef = useRef<AmbientSound | null>(null);
  const skinRef = useRef<BirdSkin>({ kind: "chick", palette: palettes[0] });
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [birdKind, setBirdKind] = useState<BirdKind>("chick");
  const [paletteId, setPaletteId] = useState<PaletteId>("sunny");

  const syncStatus = useCallback((nextStatus: GameStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    birdYRef.current = 236;
    velocityRef.current = 0;
    frameRef.current = 0;
    pipesRef.current = [
      createPipe(gameWidth + 80, 0, 1),
      createPipe(gameWidth + 80 + pipeSpacing, 1, 2),
      createPipe(gameWidth + 80 + pipeSpacing * 2, 2, 3)
    ];
  }, []);

  const finishGame = useCallback(() => {
    if (statusRef.current === "ended") return;
    playCrashSound(audioContextRef);
    bestRef.current = Math.max(bestRef.current, scoreRef.current);
    setBest(bestRef.current);
    syncStatus("ended");
  }, [syncStatus]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") {
      syncStatus("paused");
      return;
    }

    if (statusRef.current === "paused") {
      syncStatus("playing");
    }
  }, [syncStatus]);

  const flap = useCallback(() => {
    if (statusRef.current === "paused") {
      syncStatus("playing");
      return;
    }

    const audioContext = getAudioContext(audioContextRef);
    if (audioContext) {
      ensureAmbientSound(audioContext, ambientSoundRef);
    }
    playFlapSound(audioContextRef);

    if (statusRef.current === "ready") {
      resetGame();
      syncStatus("playing");
    }

    if (statusRef.current === "ended") {
      resetGame();
      syncStatus("playing");
    }

    velocityRef.current = flapPower;
  }, [resetGame, syncStatus]);

  useEffect(() => {
    skinRef.current = {
      kind: birdKind,
      palette: palettes.find((palette) => palette.id === paletteId) ?? palettes[0]
    };
  }, [birdKind, paletteId]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      void navigator.serviceWorker.register(`${basePath}/sw.js`);
    }
  }, []);

  useEffect(() => {
    const storedBest = Number(window.localStorage.getItem("sky-hop-best") || 0);
    if (Number.isFinite(storedBest)) {
      bestRef.current = storedBest;
      setBest(storedBest);
    }

    resetGame();
  }, [resetGame]);

  useEffect(() => {
    window.localStorage.setItem("sky-hop-best", String(best));
  }, [best]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        togglePause();
        return;
      }

      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "Enter") {
        event.preventDefault();
        flap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flap, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = gameWidth * dpr;
    canvas.height = gameHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;

    const loop = () => {
      frameRef.current += 1;

      if (statusRef.current === "playing") {
        stepGame(finishGame);
      }

      const weather = getWeather(frameRef.current);
      updateAmbientSound(audioContextRef, ambientSoundRef, weather);
      if (statusRef.current === "playing" && frameRef.current - npcCheerFrameRef.current > 380) {
        npcCheerFrameRef.current = frameRef.current;
        playNpcCheerSound(audioContextRef, Math.floor(frameRef.current / 380));
      }

      drawGame(context, {
        status: statusRef.current,
        score: scoreRef.current,
        best: bestRef.current,
        birdY: birdYRef.current,
        velocity: velocityRef.current,
        pipes: pipesRef.current,
        frame: frameRef.current,
        skin: skinRef.current,
        weather
      });

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [finishGame]);

  const statusText =
    status === "ready" ? "点击开始" : status === "playing" ? "保持节奏" : status === "paused" ? "继续" : "再来一局";

  return (
    <main className="game-shell">
      <section className="game-panel" aria-label="像素飞鸟小游戏">
        <div className="scorebar" aria-live="polite">
          <div>
            <span>得分</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>最高</span>
            <strong>{best}</strong>
          </div>
          <button type="button" onClick={flap} aria-label={statusText}>
            {statusText}
          </button>
        </div>

        <div className="skinbar" aria-label="皮肤选择">
          <div className="skin-group">
            <span>鸟</span>
            <div className="segmented">
              {birdKinds.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  className={birdKind === kind.id ? "active" : ""}
                  onClick={() => setBirdKind(kind.id)}
                  aria-pressed={birdKind === kind.id}
                >
                  {kind.name}
                </button>
              ))}
            </div>
          </div>

          <div className="skin-group">
            <span>颜色</span>
            <div className="swatches">
              {palettes.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className={paletteId === palette.id ? "active" : ""}
                  onClick={() => setPaletteId(palette.id)}
                  aria-label={palette.name}
                  aria-pressed={paletteId === palette.id}
                  style={{ background: palette.body }}
                />
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="canvas-button" onClick={flap} aria-label="点击让小鸟飞起来">
          <canvas ref={canvasRef} width={gameWidth} height={gameHeight} />
        </button>
      </section>
    </main>
  );

  function stepGame(onGameOver: () => void) {
    velocityRef.current += gravity;
    birdYRef.current += velocityRef.current;

    const pipes = pipesRef.current;
    for (const pipe of pipes) {
      pipe.x -= pipeSpeed;

      if (!pipe.passed && pipe.x + pipeWidth < birdX - birdSize / 2) {
        pipe.passed = true;
        const nextScore = scoreRef.current + 1;
        const isMilestone = nextScore % 10 === 0;
        const isNewRecord = nextScore > bestRef.current;
        scoreRef.current = nextScore;

        if (isMilestone) {
          playMilestoneSound(audioContextRef);
        } else {
          playScoreSound(audioContextRef);
        }

        if (isNewRecord) {
          bestRef.current = nextScore;
          setBest(nextScore);
          playRecordSound(audioContextRef, isMilestone ? 0.16 : 0);
        }

        setScore(nextScore);
      }
    }

    if (pipes.length && pipes[0].x + pipeWidth < -16) {
      pipes.shift();
      const lastPipe = pipes[pipes.length - 1];
      pipes.push(createPipe(lastPipe.x + pipeSpacing, frameRef.current, lastPipe.scoreValue + 1));
    }

    const birdRect = {
      x: birdX - birdSize / 2 + 4,
      y: birdYRef.current - birdSize / 2 + 3,
      width: birdSize - 8,
      height: birdSize - 6
    };

    const floorY = gameHeight - groundHeight;
    const hitBoundary = birdRect.y <= 0 || birdRect.y + birdRect.height >= floorY;
    const hitPipe = pipes.some((pipe) => {
      const topHeight = pipe.gapY - pipeGap / 2;
      const bottomY = pipe.gapY + pipeGap / 2;
      const mechanismRect = getMechanismRect(pipe, frameRef.current);
      return (
        intersects(birdRect, { x: pipe.x, y: 0, width: pipeWidth, height: topHeight }) ||
        intersects(birdRect, { x: pipe.x, y: bottomY, width: pipeWidth, height: floorY - bottomY }) ||
        (mechanismRect ? intersects(birdRect, mechanismRect) : false)
      );
    });

    if (hitBoundary || hitPipe) {
      onGameOver();
    }
  }
}

function createPipe(x: number, seed: number, scoreValue: number): Pipe {
  const wave = Math.sin(seed * 1.7) * 70;
  const base = 238 + wave + ((seed * 43) % 86);

  return {
    x,
    gapY: clamp(base, 168, gameHeight - groundHeight - 152),
    passed: false,
    scoreValue,
    mechanism: createMechanism(scoreValue)
  };
}

function createMechanism(scoreValue: number): Mechanism | undefined {
  if (scoreValue < 4 || scoreValue % 10 === 0 || scoreValue % 3 !== 0) return undefined;

  const kinds: MechanismKind[] = ["gear", "spinner", "spark"];
  return {
    kind: kinds[scoreValue % kinds.length],
    offsetY: scoreValue % 2 === 0 ? -34 : 34
  };
}

function drawGame(
  context: CanvasRenderingContext2D,
  game: {
    status: GameStatus;
    score: number;
    best: number;
    birdY: number;
    velocity: number;
    pipes: Pipe[];
    frame: number;
    skin: BirdSkin;
    weather: WeatherState;
  }
) {
  context.clearRect(0, 0, gameWidth, gameHeight);
  drawSky(context, game.frame, game.weather);
  drawPipes(context, game.pipes, game.best, game.frame);
  drawGround(context, game.frame);
  drawNpcs(context, game.frame, game.pipes);
  drawWeather(context, game.frame, game.weather);
  drawBird(context, game.birdY, game.velocity, game.frame, game.skin);
  drawScore(context, game.score);

  if (game.status !== "playing") {
    drawOverlay(context, game.status, game.score, game.best);
  }
}

function getWeather(frame: number): WeatherState {
  const cycleIndex = Math.floor(frame / weatherDurationFrames);
  const frameInWeather = frame % weatherDurationFrames;
  const current = weatherCycle[cycleIndex % weatherCycle.length];
  const next = weatherCycle[(cycleIndex + 1) % weatherCycle.length];
  const rawBlend = (frameInWeather - (weatherDurationFrames - weatherBlendFrames)) / weatherBlendFrames;
  const blend = smoothStep(clamp(rawBlend, 0, 1));

  return { current, next, blend };
}

function drawSky(context: CanvasRenderingContext2D, frame: number, weather: WeatherState) {
  drawSkyBase(context, weather.current);
  if (weather.blend > 0) {
    context.save();
    context.globalAlpha = weather.blend;
    drawSkyBase(context, weather.next);
    context.restore();
  }

  drawSkyDetails(context, frame, weather.current, 1 - weather.blend);
  if (weather.blend > 0) {
    drawSkyDetails(context, frame, weather.next, weather.blend);
  }
}

function drawSkyBase(context: CanvasRenderingContext2D, weather: WeatherMode) {
  const gradient = context.createLinearGradient(0, 0, 0, gameHeight);
  if (weather === "cloudy" || weather === "rainy") {
    gradient.addColorStop(0, "#7e9fb3");
    gradient.addColorStop(0.55, "#a7bdc4");
    gradient.addColorStop(1, "#d2c887");
  } else if (weather === "snowy") {
    gradient.addColorStop(0, "#9dc9e5");
    gradient.addColorStop(0.55, "#cfe8f5");
    gradient.addColorStop(1, "#eef3e2");
  } else {
    gradient.addColorStop(0, "#6ec6f1");
    gradient.addColorStop(0.55, "#93dcff");
    gradient.addColorStop(1, "#f8d982");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, gameWidth, gameHeight);
}

function drawSkyDetails(context: CanvasRenderingContext2D, frame: number, weather: WeatherMode, alpha: number) {
  if (alpha <= 0) return;
  context.save();
  context.globalAlpha = alpha;
  const windBoost = weather === "windy" ? 0.8 : 0;
  const cloudTint = weather === "cloudy" || weather === "rainy" ? "#d8dee2" : "#ffffff";
  drawPixelCloud(context, 42 - (frame * (0.2 + windBoost)) % 520, 74, 1, cloudTint);
  drawPixelCloud(context, 282 - (frame * (0.14 + windBoost)) % 560, 134, 0.82, cloudTint);
  drawPixelCloud(context, 462 - (frame * (0.1 + windBoost)) % 560, 48, 0.72, cloudTint);
  if (weather === "cloudy" || weather === "rainy") {
    drawPixelCloud(context, 174 - (frame * 0.16) % 560, 34, 0.95, "#c6cdd2");
  }

  if (weather !== "rainy" && weather !== "cloudy") {
    context.fillStyle = "#fff6b0";
    context.fillRect(318, 42, 42, 42);
    context.fillStyle = "#ffd867";
    context.fillRect(326, 50, 26, 26);
  } else {
    context.fillStyle = "rgba(255, 244, 168, 0.38)";
    context.fillRect(326, 50, 26, 26);
  }
  context.restore();
}

function drawPixelCloud(context: CanvasRenderingContext2D, x: number, y: number, scale: number, color = "#ffffff") {
  const size = 14 * scale;
  context.fillStyle = color;
  context.fillRect(x, y + size, size * 5, size * 2);
  context.fillRect(x + size, y, size * 2, size * 4);
  context.fillRect(x + size * 3, y + size * 0.7, size * 2.5, size * 3.3);
  context.fillStyle = "#dff5ff";
  context.fillRect(x, y + size * 2.5, size * 5.5, size * 0.7);
}

function drawWeather(context: CanvasRenderingContext2D, frame: number, weather: WeatherState) {
  drawWeatherLayer(context, frame, weather.current, 1 - weather.blend);
  if (weather.blend > 0) {
    drawWeatherLayer(context, frame, weather.next, weather.blend);
  }
}

function drawWeatherLayer(context: CanvasRenderingContext2D, frame: number, weather: WeatherMode, alpha: number) {
  if (alpha <= 0) return;
  context.save();
  context.globalAlpha = alpha;
  if (weather === "rainy") {
    context.strokeStyle = "rgba(66, 120, 178, 0.72)";
    context.lineWidth = 3;
    for (let i = 0; i < 34; i += 1) {
      const x = (i * 47 + frame * 1.4) % (gameWidth + 80) - 40;
      const y = (i * 83 + frame * 4.2) % (gameHeight - groundHeight);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - 10, y + 24);
      context.stroke();
    }
  }

  if (weather === "snowy") {
    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    for (let i = 0; i < 38; i += 1) {
      const x = (i * 41 + Math.sin(frame / 36 + i) * 14) % gameWidth;
      const y = (i * 67 + frame * 0.72) % (gameHeight - groundHeight);
      const size = i % 3 === 0 ? 5 : 3;
      context.fillRect(x, y, size, size);
    }
  }

  if (weather === "windy") {
    context.strokeStyle = "rgba(255, 255, 255, 0.56)";
    context.lineWidth = 4;
    for (let i = 0; i < 7; i += 1) {
      const x = (frame * 2.1 + i * 86) % (gameWidth + 130) - 90;
      const y = 82 + i * 58 + Math.sin(frame / 34 + i) * 8;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 44, y);
      context.lineTo(x + 62, y - 8);
      context.stroke();
    }
  }

  if (weather === "cloudy") {
    context.fillStyle = "rgba(79, 91, 101, 0.12)";
    context.fillRect(0, 0, gameWidth, gameHeight - groundHeight);
  }
  context.restore();
}

function drawPipes(context: CanvasRenderingContext2D, pipes: Pipe[], best: number, frame: number) {
  const floorY = gameHeight - groundHeight;

  for (const pipe of pipes) {
    const topHeight = pipe.gapY - pipeGap / 2;
    const bottomY = pipe.gapY + pipeGap / 2;
    const isGoldPipe = pipe.scoreValue % 10 === 0;

    drawPipePart(context, pipe.x, 0, pipeWidth, topHeight, true, isGoldPipe);
    drawPipePart(context, pipe.x, bottomY, pipeWidth, floorY - bottomY, false, isGoldPipe);
    drawMechanism(context, pipe, frame);
  }
}

function drawPipePart(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  flip: boolean,
  isGoldPipe: boolean
) {
  const capHeight = 28;
  const capY = flip ? y + height - capHeight : y;
  const bodyY = flip ? y : y + capHeight;
  const bodyHeight = Math.max(height - capHeight, 0);

  const colors = isGoldPipe
    ? {
        dark: "#8b5a05",
        body: "#d99812",
        shine: "#fff18a",
        edge: "#5e3900",
        capDark: "#7a4700",
        cap: "#f2b622"
      }
    : {
        dark: "#146b37",
        body: "#2fb85f",
        shine: "#92f27c",
        edge: "#0b4f2d",
        capDark: "#0f5d33",
        cap: "#39c96e"
      };

  context.fillStyle = colors.dark;
  context.fillRect(x, bodyY, width, bodyHeight);
  context.fillStyle = colors.body;
  context.fillRect(x + 7, bodyY, width - 14, bodyHeight);
  context.fillStyle = colors.shine;
  context.fillRect(x + 13, bodyY, 10, bodyHeight);
  context.fillStyle = colors.edge;
  context.fillRect(x + width - 12, bodyY, 7, bodyHeight);

  context.fillStyle = colors.capDark;
  context.fillRect(x - 6, capY, width + 12, capHeight);
  context.fillStyle = colors.cap;
  context.fillRect(x, capY + 5, width, capHeight - 10);
  context.fillStyle = colors.shine;
  context.fillRect(x + 11, capY + 8, 12, capHeight - 16);

  if (isGoldPipe) {
    context.fillStyle = "#fff8bd";
    context.fillRect(x + width - 25, capY + 8, 8, 8);
  }
}

function drawMechanism(context: CanvasRenderingContext2D, pipe: Pipe, frame: number) {
  const rect = getMechanismRect(pipe, frame);
  if (!rect || rect.x > gameWidth + 30 || rect.x < -40) return;

  context.save();
  context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
  context.rotate(frame / 22);

  if (pipe.mechanism?.kind === "gear") {
    context.fillStyle = "#6b4a2c";
    context.fillRect(-10, -10, 20, 20);
    context.fillStyle = "#f0c65a";
    context.fillRect(-6, -6, 12, 12);
    context.fillStyle = "#3d2a1b";
    context.fillRect(-3, -3, 6, 6);
    for (let i = 0; i < 4; i += 1) {
      context.rotate(Math.PI / 2);
      context.fillStyle = "#6b4a2c";
      context.fillRect(-3, -15, 6, 6);
    }
  }

  if (pipe.mechanism?.kind === "spinner") {
    context.fillStyle = "#7c4d25";
    context.fillRect(-3, -4, 6, 8);
    context.fillStyle = "#f6e36c";
    context.fillRect(-3, -18, 6, 14);
    context.fillStyle = "#e85b7d";
    context.fillRect(4, -3, 14, 6);
    context.fillStyle = "#54a7f7";
    context.fillRect(-3, 4, 6, 14);
    context.fillStyle = "#58cfa6";
    context.fillRect(-18, -3, 14, 6);
  }

  if (pipe.mechanism?.kind === "spark") {
    context.fillStyle = "#7d351b";
    context.fillRect(-10, -8, 20, 16);
    context.fillStyle = "#fff18a";
    context.fillRect(-5, -15, 10, 30);
    context.fillStyle = "#f26f3b";
    context.fillRect(-12, -3, 24, 6);
  }

  context.restore();
}

function getMechanismRect(pipe: Pipe, frame: number) {
  if (!pipe.mechanism) return null;

  const sway = Math.sin(frame / 36 + pipe.scoreValue) * 8;
  const centerX = pipe.x + pipeWidth + 34;
  const centerY = pipe.gapY + pipe.mechanism.offsetY + sway;
  const size = pipe.mechanism.kind === "spark" ? 22 : 24;

  return {
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size
  };
}

function drawGround(context: CanvasRenderingContext2D, frame: number) {
  const groundY = gameHeight - groundHeight;
  context.fillStyle = "#7b5125";
  context.fillRect(0, groundY, gameWidth, groundHeight);
  context.fillStyle = "#e9c64d";
  context.fillRect(0, groundY, gameWidth, 18);
  context.fillStyle = "#4aa33a";
  context.fillRect(0, groundY - 10, gameWidth, 14);

  const offset = Math.floor((frame * pipeSpeed) % 32);
  for (let x = -offset; x < gameWidth + 32; x += 32) {
    context.fillStyle = "#c8903c";
    context.fillRect(x, groundY + 28, 18, 8);
    context.fillStyle = "#5e351c";
    context.fillRect(x + 14, groundY + 56, 24, 8);
  }
}

function drawNpcs(context: CanvasRenderingContext2D, frame: number, pipes: Pipe[]) {
  const groundY = gameHeight - groundHeight;
  const animals = [
    { kind: "rabbit", x: 32, bubble: "啾!", speed: 0.52, scale: 1.2 },
    { kind: "cat", x: 122, bubble: "冲呀", speed: 0.62, scale: 1.18 },
    { kind: "frog", x: 214, bubble: "叮!", speed: 0.48, scale: 1.16 },
    { kind: "dog", x: 302, bubble: "汪!", speed: 0.58, scale: 1.2 },
    { kind: "fox", x: 392, bubble: "加油", speed: 0.66, scale: 1.17 },
    { kind: "panda", x: 482, bubble: "棒!", speed: 0.44, scale: 1.2 },
    { kind: "turtle", x: 566, bubble: "稳住", speed: 0.36, scale: 1.14 }
  ];

  for (let i = 0; i < animals.length; i += 1) {
    const animal = animals[i];
    const x = (animal.x - (frame * animal.speed) % 690 + 690) % 690 - 86;
    const y = groundY + 23 + Math.sin(frame / 22 + i) * 2;
    const edgeAlpha = clamp(Math.min((x + 42) / 44, (gameWidth + 42 - x) / 44), 0, 1);
    if (edgeAlpha <= 0) continue;

    context.save();
    context.globalAlpha = edgeAlpha;

    drawAnimal(context, animal.kind, x, y, animal.scale);

    if ((Math.floor(frame / 150) + i) % 4 === 0) {
      drawSpeechBubble(context, x + 8, y - 42, animal.bubble);
    }
    context.restore();
  }
}

function drawAnimal(context: CanvasRenderingContext2D, kind: string, x: number, y: number, scale: number) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  if (kind === "rabbit") {
    context.fillStyle = "#f4f0e6";
    context.fillRect(-8, -18, 16, 16);
    context.fillRect(-6, -30, 5, 14);
    context.fillRect(3, -30, 5, 14);
    context.fillStyle = "#d9a1b4";
    context.fillRect(-4, -27, 2, 9);
    context.fillRect(5, -27, 2, 9);
  } else if (kind === "cat") {
    context.fillStyle = "#f0b05a";
    context.fillRect(-9, -18, 18, 17);
    context.fillRect(-7, -25, 6, 8);
    context.fillRect(2, -25, 6, 8);
    context.fillStyle = "#6b3d22";
    context.fillRect(8, -11, 10, 4);
  } else if (kind === "frog") {
    context.fillStyle = "#5fbf62";
    context.fillRect(-10, -15, 20, 14);
    context.fillStyle = "#daf7b8";
    context.fillRect(-6, -20, 5, 5);
    context.fillRect(2, -20, 5, 5);
  } else if (kind === "dog") {
    context.fillStyle = "#c9864a";
    context.fillRect(-11, -18, 22, 17);
    context.fillStyle = "#7b5125";
    context.fillRect(-13, -20, 6, 10);
    context.fillRect(7, -20, 6, 10);
    context.fillRect(9, -10, 10, 4);
  } else if (kind === "fox") {
    context.fillStyle = "#e66f2e";
    context.fillRect(-10, -18, 20, 17);
    context.fillRect(-7, -25, 6, 8);
    context.fillRect(2, -25, 6, 8);
    context.fillStyle = "#fff0b8";
    context.fillRect(-4, -8, 12, 7);
    context.fillStyle = "#e66f2e";
    context.fillRect(10, -12, 14, 6);
    context.fillStyle = "#fff0b8";
    context.fillRect(20, -12, 4, 6);
  } else if (kind === "panda") {
    context.fillStyle = "#f4f0e6";
    context.fillRect(-11, -19, 22, 18);
    context.fillStyle = "#2d2a2a";
    context.fillRect(-12, -23, 7, 7);
    context.fillRect(5, -23, 7, 7);
    context.fillRect(-7, -13, 5, 5);
    context.fillRect(3, -13, 5, 5);
  } else {
    context.fillStyle = "#6aa86f";
    context.fillRect(-12, -13, 24, 12);
    context.fillStyle = "#9ed17f";
    context.fillRect(-7, -19, 13, 8);
    context.fillStyle = "#d4b15f";
    context.fillRect(-3, -22, 8, 5);
  }

  context.fillStyle = "#1f1f2a";
  context.fillRect(-4, -12, 2, 2);
  context.fillRect(4, -12, 2, 2);
  context.restore();
}

function drawSpeechBubble(context: CanvasRenderingContext2D, x: number, y: number, text: string) {
  context.fillStyle = "#fff0b8";
  context.fillRect(x - 20, y - 15, 40, 20);
  context.fillStyle = "#7b5125";
  context.fillRect(x - 20, y - 15, 40, 3);
  context.fillRect(x - 20, y + 2, 40, 3);
  context.fillRect(x - 20, y - 15, 3, 20);
  context.fillRect(x + 17, y - 15, 3, 20);
  context.fillStyle = "#5d2f18";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(text, x, y - 5);
}

function drawBird(context: CanvasRenderingContext2D, y: number, velocity: number, frame: number, skin: BirdSkin) {
  const wingUp = Math.sin(frame / 5) > 0;
  const tilt = clamp(velocity / 13, -0.45, 0.6);
  const palette = skin.palette;

  context.save();
  context.translate(birdX, y);
  context.rotate(tilt);

  if (skin.kind === "owl") {
    drawOwl(context, palette, wingUp);
  } else if (skin.kind === "parrot") {
    drawParrot(context, palette, wingUp);
  } else {
    drawChick(context, palette, wingUp);
  }

  context.restore();
}

function drawChick(context: CanvasRenderingContext2D, palette: BirdPalette, wingUp: boolean) {
  context.fillStyle = palette.shadow;
  context.fillRect(-17, -11, 30, 25);
  context.fillStyle = palette.body;
  context.fillRect(-14, -15, 27, 26);
  context.fillStyle = palette.belly;
  context.fillRect(-7, -6, 22, 18);
  context.fillStyle = palette.beak;
  context.fillRect(8, -3, 20, 8);
  context.fillStyle = palette.shadow;
  context.fillRect(19, 1, 8, 4);
  drawEye(context, 3, -12);
  context.fillStyle = palette.wing;
  context.fillRect(-19, wingUp ? -2 : 6, 17, 12);
  context.fillStyle = palette.body;
  context.fillRect(-16, wingUp ? -6 : 9, 13, 8);
}

function drawOwl(context: CanvasRenderingContext2D, palette: BirdPalette, wingUp: boolean) {
  context.fillStyle = palette.shadow;
  context.fillRect(-17, -16, 31, 31);
  context.fillStyle = palette.body;
  context.fillRect(-14, -18, 28, 31);
  context.fillStyle = palette.belly;
  context.fillRect(-9, -5, 18, 16);
  context.fillStyle = palette.shadow;
  context.fillRect(-15, -22, 9, 8);
  context.fillRect(5, -22, 9, 8);
  drawEye(context, -8, -13);
  drawEye(context, 4, -13);
  context.fillStyle = palette.beak;
  context.fillRect(0, -5, 8, 7);
  context.fillStyle = palette.wing;
  context.fillRect(-22, wingUp ? -7 : 3, 12, 18);
  context.fillRect(10, wingUp ? -5 : 5, 12, 18);
}

function drawParrot(context: CanvasRenderingContext2D, palette: BirdPalette, wingUp: boolean) {
  context.fillStyle = palette.shadow;
  context.fillRect(-18, -11, 31, 25);
  context.fillStyle = palette.body;
  context.fillRect(-15, -15, 29, 26);
  context.fillStyle = palette.belly;
  context.fillRect(-2, -7, 16, 18);
  context.fillStyle = palette.wing;
  context.fillRect(-22, wingUp ? -4 : 5, 17, 14);
  context.fillStyle = palette.beak;
  context.fillRect(9, -5, 22, 8);
  context.fillStyle = "#2f1b18";
  context.fillRect(22, -1, 8, 4);
  context.fillStyle = palette.wing;
  context.fillRect(-10, -23, 8, 8);
  context.fillRect(-2, -25, 8, 9);
  drawEye(context, 2, -12);
}

function drawEye(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#ffffff";
  context.fillRect(x, y, 8, 8);
  context.fillStyle = "#1f1f2a";
  context.fillRect(x + 4, y + 3, 3, 3);
}

function drawScore(context: CanvasRenderingContext2D, score: number) {
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = "700 42px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.lineWidth = 7;
  context.strokeStyle = "#552b17";
  context.strokeText(String(score), gameWidth / 2, 25);
  context.fillStyle = "#fff3aa";
  context.fillText(String(score), gameWidth / 2, 25);
}

function drawOverlay(context: CanvasRenderingContext2D, status: GameStatus, score: number, best: number) {
  context.fillStyle = "rgba(34, 23, 18, 0.36)";
  context.fillRect(0, 0, gameWidth, gameHeight);

  context.fillStyle = "#fff0b8";
  context.fillRect(54, 192, gameWidth - 108, 184);
  context.fillStyle = "#8d4f26";
  context.fillRect(54, 192, gameWidth - 108, 10);
  context.fillRect(54, 366, gameWidth - 108, 10);
  context.fillRect(54, 192, 10, 184);
  context.fillRect(gameWidth - 64, 192, 10, 184);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#5d2f18";
  context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(getOverlayTitle(status), gameWidth / 2, 238);

  context.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`本局 ${score}   最高 ${best}`, gameWidth / 2, 282);

  context.fillStyle = "#2e7d36";
  context.fillRect(118, 314, 196, 34);
  context.fillStyle = "#f7ffe8";
  context.font = "700 17px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(status === "paused" ? "Esc 继续游戏" : "点击 / 空格 起飞", gameWidth / 2, 331);
}

function getOverlayTitle(status: GameStatus) {
  if (status === "ready") return "像素飞鸟";
  if (status === "paused") return "已暂停";
  return "游戏结束";
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function getAudioContext(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const audioWindow = window as AudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) return null;

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextConstructor();
  }

  if (audioContextRef.current.state === "suspended") {
    void audioContextRef.current.resume();
  }

  return audioContextRef.current;
}

function ensureAmbientSound(
  audioContext: AudioContext,
  ambientSoundRef: React.MutableRefObject<AmbientSound | null>
) {
  if (ambientSoundRef.current) return ambientSoundRef.current;

  const rainGain = audioContext.createGain();
  const windGain = audioContext.createGain();
  const rainFilter = audioContext.createBiquadFilter();
  const windFilter = audioContext.createBiquadFilter();
  const rainSource = audioContext.createBufferSource();
  const windSource = audioContext.createBufferSource();

  rainGain.gain.value = 0.001;
  windGain.gain.value = 0.001;
  rainFilter.type = "highpass";
  rainFilter.frequency.value = 1300;
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;

  rainSource.buffer = createNoiseBuffer(audioContext, 2, 1);
  windSource.buffer = createNoiseBuffer(audioContext, 3, 0.55);
  rainSource.loop = true;
  windSource.loop = true;

  rainSource.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(audioContext.destination);
  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(audioContext.destination);

  rainSource.start();
  windSource.start();

  ambientSoundRef.current = {
    rainGain,
    windGain,
    rainFilter,
    windFilter,
    rainSource,
    windSource
  };

  return ambientSoundRef.current;
}

function updateAmbientSound(
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  ambientSoundRef: React.MutableRefObject<AmbientSound | null>,
  weather: WeatherState
) {
  const audioContext = audioContextRef.current;
  const ambientSound = ambientSoundRef.current;
  if (!audioContext || !ambientSound) return;

  const rainAmount = getWeatherAmount(weather, "rainy");
  const windAmount = Math.max(getWeatherAmount(weather, "windy"), getWeatherAmount(weather, "snowy") * 0.35);
  const now = audioContext.currentTime;

  ambientSound.rainGain.gain.setTargetAtTime(0.001 + rainAmount * 0.013, now, 0.8);
  ambientSound.windGain.gain.setTargetAtTime(0.001 + windAmount * 0.009, now, 0.9);
  ambientSound.rainFilter.frequency.setTargetAtTime(1200 + rainAmount * 900, now, 1.1);
  ambientSound.windFilter.frequency.setTargetAtTime(360 + windAmount * 240, now, 1.1);
}

function getWeatherAmount(weather: WeatherState, mode: WeatherMode) {
  const currentAmount = weather.current === mode ? 1 - weather.blend : 0;
  const nextAmount = weather.next === mode ? weather.blend : 0;
  return currentAmount + nextAmount;
}

function createNoiseBuffer(audioContext: AudioContext, duration: number, intensity: number) {
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;

  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.86 + white * 0.14;
    data[i] = (white * 0.55 + previous * 0.45) * intensity;
  }

  return buffer;
}

function playFlapSound(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const audioContext = getAudioContext(audioContextRef);
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.055);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

function playScoreSound(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const audioContext = getAudioContext(audioContextRef);
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.075);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.15);
}

function playMilestoneSound(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const audioContext = getAudioContext(audioContextRef);
  if (!audioContext) return;

  playTone(audioContext, 784, 0, 0.08, 0.07, "triangle");
  playTone(audioContext, 1046, 0.075, 0.1, 0.08, "triangle");
  playTone(audioContext, 1568, 0.16, 0.16, 0.06, "sine");
}

function playRecordSound(audioContextRef: React.MutableRefObject<AudioContext | null>, delay = 0) {
  const audioContext = getAudioContext(audioContextRef);
  if (!audioContext) return;

  playTone(audioContext, 659, delay, 0.07, 0.05, "sine");
  playTone(audioContext, 988, delay + 0.07, 0.11, 0.06, "sine");
}

function playNpcCheerSound(audioContextRef: React.MutableRefObject<AudioContext | null>, variant: number) {
  const audioContext = audioContextRef.current;
  if (!audioContext) return;

  const patterns = [
    [740, 920],
    [660, 880],
    [820, 1040],
    [590, 760]
  ];
  const pattern = patterns[variant % patterns.length];

  playTone(audioContext, pattern[0], 0, 0.045, 0.016, "triangle");
  playTone(audioContext, pattern[1], 0.055, 0.05, 0.014, "triangle");
}

function playCrashSound(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const audioContext = getAudioContext(audioContextRef);
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(180, now);
  oscillator.frequency.exponentialRampToValueAtTime(52, now + 0.28);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.34);
}

function playTone(
  audioContext: AudioContext,
  frequency: number,
  delay: number,
  duration: number,
  volume: number,
  type: OscillatorType
) {
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}
