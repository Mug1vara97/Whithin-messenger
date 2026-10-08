import { useEffect, useMemo, useRef, useState } from "react";
import "./BirthdayCardPage.css";
import TextType from "./TextType.jsx";
import { CARDS, HEADINGS } from "./words.js";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Unbounded:wght@400;700;800&display=swap";

const CONFIG = {
  zGap: 800,
  camSpeed: 2.5,
  lerp: 0.08,
  starCount: 150,
};

function useBirthdayPageChrome() {
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(null, "", "/birthday");
    }

    document.body.classList.add("birthday-card-open");
    const previousTitle = document.title;
    document.title = "С днём рождения";

    if (!document.getElementById("birthday-card-fonts")) {
      const link = document.createElement("link");
      link.id = "birthday-card-fonts";
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }

    return () => {
      document.body.classList.remove("birthday-card-open");
      document.title = previousTitle;
    };
  }, []);
}

function isPhoneViewport() {
  return Math.min(window.innerWidth, window.innerHeight) <= 480
    || window.matchMedia("(pointer: coarse) and (max-width: 932px)").matches;
}

function buildSequence() {
  const items = [];

  CARDS.forEach((card, index) => {
    if (index % 4 === 0) {
      items.push({
        id: `text-${index}`,
        type: "text",
        word: HEADINGS[Math.floor(index / 4) % HEADINGS.length],
        note: "",
      });
    }
    items.push({
      id: `card-${index}`,
      type: "card",
      word: card.word,
      note: card.note,
      number: index + 1,
      total: CARDS.length,
    });
  });
  return items;
}

function layoutSpread() {
  const phone = isPhoneViewport();
  const width = window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  return {
    phone,
    width,
    height,
    spreadX: width * (phone ? 0.08 : 0.3),
    spreadY: height * (phone ? 0.1 : 0.3),
  };
}

const HELLO = "Привет,";
const INTRO_LINES = [
  "захотел как-то оригинально поздравить,",
  "и придумал вот такое,",
  "надеюсь тебе понравится)",
];

function HyperTunnel({ sequence }) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);

  useEffect(() => {
    const world = worldRef.current;
    const viewport = viewportRef.current;
    if (!world || !viewport) return undefined;

    const loopSize = sequence.length * CONFIG.zGap;
    const itemEls = [...world.querySelectorAll(".item")];
    const nodes = itemEls.map((el, index) => {
      const item = sequence[index];
      return {
        el,
        type: item.type,
        x: 0,
        y: 0,
        rot: item.type === "text" ? 0 : (Math.random() - 0.5) * 30,
        baseZ: -index * CONFIG.zGap,
      };
    });

    const placeItems = () => {
      const layout = layoutSpread();
      document.documentElement.style.setProperty("--app-h", `${Math.round(layout.height)}px`);
      nodes.forEach((item, index) => {
        if (item.type !== "card") {
          item.x = 0;
          item.y = 0;
          return;
        }
        const angle = (index / sequence.length) * Math.PI * 6;
        item.x = Math.cos(angle) * layout.spreadX;
        item.y = Math.sin(angle) * layout.spreadY;
      });
      return layout;
    };

    placeItems();

    const sparks = [];
    for (let i = 0; i < CONFIG.starCount; i += 1) {
      const el = document.createElement("div");
      el.className = "spark";
      world.appendChild(el);
      sparks.push(el);
      nodes.push({
        el,
        type: "star",
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        rot: 0,
        baseZ: -Math.random() * loopSize,
      });
    }

    const state = {
      scroll: 0,
      target: 120,
      velocity: 0,
      mouseX: 0,
      mouseY: 0,
      touching: false,
      inertia: 0,
    };

    let lastTouchY = 0;
    let lastTouchTime = 0;

    const onMove = (event) => {
      const point = event.touches ? event.touches[0] : event;
      if (!point) return;
      state.mouseX = (point.clientX / window.innerWidth - 0.5) * 2;
      state.mouseY = (point.clientY / window.innerHeight - 0.5) * 2;
    };

    const onWheel = (event) => {
      event.preventDefault();
      state.target += event.deltaY;
      state.inertia = 0;
    };

    const onTouchStart = (event) => {
      lastTouchY = event.touches[0].clientY;
      lastTouchTime = performance.now();
      state.touching = true;
      state.inertia = 0;
    };

    const onTouchMove = (event) => {
      onMove(event);
      event.preventDefault();
      const y = event.touches[0].clientY;
      const now = performance.now();
      const dy = lastTouchY - y;
      const dt = Math.max(8, now - lastTouchTime);
      state.target += dy;
      state.inertia = dy / dt;
      lastTouchY = y;
      lastTouchTime = now;
    };

    const onTouchEnd = () => {
      state.touching = false;
    };

    const onResize = () => {
      placeItems();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    let raf = 0;
    let lastTime = performance.now();
    const tick = (time) => {
      const delta = Math.min(48, time - lastTime) / 1000;
      lastTime = time;

      if (!state.touching && Math.abs(state.inertia) > 0.02) {
        state.target += state.inertia * 1000 * delta;
        state.inertia *= Math.exp(-delta * 3.2);
      } else if (!state.touching) {
        state.inertia = 0;
      }

      const smooth = 1 - Math.exp(-60 * CONFIG.lerp * delta);
      const prev = state.scroll;
      state.scroll += (state.target - state.scroll) * smooth;
      const speed = (state.scroll - prev) / Math.max(delta, 0.001);
      state.velocity += (speed * 0.016 - state.velocity) * 0.12;

      const tiltX = state.mouseY * 5 - state.velocity * 0.5;
      const tiltY = state.mouseX * 5;
      world.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      viewport.style.perspective = `${1000 - Math.min(Math.abs(state.velocity) * 10, 600)}px`;

      const cameraZ = state.scroll * CONFIG.camSpeed;
      nodes.forEach((item) => {
        const relZ = item.baseZ + cameraZ;
        let vizZ = ((relZ % loopSize) + loopSize) % loopSize;
        if (vizZ > 500) vizZ -= loopSize;

        let alpha = 1;
        if (vizZ < -3000) alpha = 0;
        else if (vizZ < -2000) alpha = (vizZ + 3000) / 1000;
        if (vizZ > 100 && item.type !== "star") alpha = 1 - (vizZ - 100) / 400;
        if (alpha < 0) alpha = 0;
        item.el.style.opacity = String(alpha);

        if (alpha > 0) {
          let trans = `translate3d(${item.x}px, ${item.y}px, ${vizZ}px)`;
          if (item.type === "star") {
            const stretch = Math.max(1, Math.min(1 + Math.abs(state.velocity) * 0.1, 10));
            trans += ` scale3d(1, 1, ${stretch})`;
          } else if (item.type === "text") {
            trans += ` rotateZ(${item.rot}deg)`;
            if (Math.abs(state.velocity) > 1) {
              const offset = state.velocity * 2;
              item.el.style.textShadow = `${offset}px 0 #ff003c, ${-offset}px 0 #00f3ff`;
            } else {
              item.el.style.textShadow = "none";
            }
          } else {
            const float = Math.sin(time * 0.001 + item.x) * 10;
            trans += ` rotateZ(${item.rot}deg) rotateY(${float}deg)`;
          }
          item.el.style.transform = trans;
        }
      });

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      sparks.forEach((node) => node.remove());
    };
  }, [sequence]);

  return (
      <div className="viewport is-entering" ref={viewportRef}>
        <div className="world" ref={worldRef}>
          {sequence.map((item) => (
            <div key={item.id} className="item" data-type={item.type}>
              {item.type === "text" ? (
                <div className="big-text">{item.word}</div>
              ) : (
                <article className="card">
                  <div className="card-header">
                    <span className="card-id">ID-{String(item.number).padStart(4, "0")}</span>
                    <span className="card-dot" />
                  </div>
                  <div className="card-body">
                    <h2>{item.word}</h2>
                    <p className="card-note">{item.note}</p>
                  </div>
                  <span className="card-index">0{item.number}</span>
                </article>
              )}
            </div>
          ))}
        </div>
      </div>
  );
}

export default function BirthdayCardPage() {
  const sequence = useMemo(() => buildSequence(), []);
  useBirthdayPageChrome();
  const [stage, setStage] = useState("intro");
  const greeting = useMemo(
    () => [HELLO, ...INTRO_LINES].join("\n"),
    [],
  );

  useEffect(() => {
    if (stage !== "fade") return undefined;
    const timer = window.setTimeout(() => setStage("cards"), 1400);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const skipIntro = () => {
    if (stage === "intro") setStage("fade");
  };

  return (
    <main className="hyper">
      {stage === "cards" && (
        <>
          <div className="stars" />
          <div className="twinkling" />
          <div className="scanlines" />
          <div className="vignette" />
          <div className="noise" />
        </>
      )}

      {stage !== "cards" && (
        <section
          className={stage === "fade" ? "intro is-leaving" : "intro"}
          onClick={skipIntro}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") skipIntro();
          }}
          role="presentation"
        >
          <div className="intro-copy">
            <TextType
              className="intro-type"
              text={greeting}
              loop={false}
              typingSpeed={48}
              initialDelay={350}
              pauseDuration={1600}
              showCursor
              cursorCharacter="|"
              onComplete={() => setStage("fade")}
            />
          </div>
        </section>
      )}

      <div className={stage === "fade" ? "curtain is-on" : "curtain"} />

      {stage === "cards" && <HyperTunnel sequence={sequence} />}
    </main>
  );
}
