const eventPage = document.querySelector(".event-page");
const dimmer = document.querySelector("#screen-dimmer");
const slotSheet = document.querySelector("#slot-sheet");
const captchaDialog = document.querySelector("#captcha-dialog");
const captchaScene = document.querySelector("#captcha-scene");
const captchaPicture = document.querySelector("#captcha-picture");
const captchaTokens = document.querySelector("#captcha-tokens");
const captchaMarks = document.querySelector("#captcha-marks");
const challengeCode = document.querySelector("#challenge-code");
const captchaFeedback = document.querySelector("#captcha-feedback");
const captchaStatus = document.querySelector("#captcha-status");
const captchaStatusMessage = document.querySelector("#captcha-status-message");
const confirmCaptcha = document.querySelector("#confirm-captcha");
const refreshCaptcha = document.querySelector("#refresh-captcha");
const toast = document.querySelector("#toast");
const startView = document.querySelector("#start-view");
const simulationClock = document.querySelector("#simulation-clock");
const clockValue = document.querySelector("#simulation-clock-value");
const resultDialog = document.querySelector("#practice-result");
const slotList = document.querySelector("#slot-list");
const simulation = new window.ReservationSimulation(() => window.performance.now());

const backgroundPool = window.CaptchaBackgrounds.map((background) => background.src);
const embeddedGlyphs = window.CaptchaEmbedded.glyphs;
const fallbackBackground = window.CaptchaEmbedded.fallbackBackground;
const readyBackgrounds = new Set();
const iconPool = Object.entries(window.CaptchaSymbols).map(([id, symbol]) => ({
  id,
  label: symbol.name,
  kind: "icon",
  src: embeddedGlyphs[symbol.src]
}));
const digitPool = Array.from({ length: 10 }, (_, value) => ({
  id: `digit-${value}`,
  label: `数字 ${value}`,
  kind: "digit",
  value: String(value),
  src: embeddedGlyphs[window.CaptchaDigits[String(value)]]
}));
const tokenPool = [...digitPool, ...iconPool];
const promptPatterns = [
  { digits: 2, icons: 1, weight: 30 },
  { digits: 1, icons: 2, weight: 30 },
  { digits: 3, icons: 0, weight: 30 },
  { digits: 0, icons: 3, weight: 10 }
];
let challenge = null;
let selectedPoints = [];
const tokenElements = new Map();
let previousBackground = "";
const imageLoads = new Map();
const imageLoadTimeoutMs = 7000;
let clockFrame;
let lastAvailability = null;
let captchaState = "selecting";
let toastTimer;
let completionTimer;
let verificationTimer;
let errorResetTimer;
const captchaTiming = { checking: 150, error: 1000, success: 600 };

function updateSlotAvailability() {
  const available = simulation.canReserve;
  if (available === lastAvailability) return;
  lastAvailability = available;
  document.querySelectorAll(".time-slot").forEach((slot) => {
    slot.disabled = !available;
    slot.dataset.remaining = available ? "200" : "0";
    slot.querySelector("em").textContent = available ? "（可预约）" : "（已约满）";
    slot.querySelector("small").textContent = available ? "剩余200人" : "剩余0人";
  });
}

function updateSimulationClock() {
  clockValue.textContent = simulation.clockText();
  updateSlotAvailability();
}

function tickSimulationClock() {
  updateSimulationClock();
  if (simulation.running) clockFrame = window.requestAnimationFrame(tickSimulationClock);
}

function startSimulation() {
  closeReservationFlow();
  window.cancelAnimationFrame(clockFrame);
  window.clearTimeout(toastTimer);
  toast.classList.remove("visible");
  simulation.start();
  challenge = null;
  selectedPoints = [];
  captchaMarks.replaceChildren();
  document.querySelectorAll(".time-slot").forEach((slot) => slot.classList.remove("selected"));
  slotList.scrollTop = 0;
  lastAvailability = null;
  startView.hidden = true;
  resultDialog.hidden = true;
  eventPage.hidden = false;
  simulationClock.hidden = false;
  tickSimulationClock();
}

function returnToStart() {
  closeReservationFlow();
  window.cancelAnimationFrame(clockFrame);
  window.clearTimeout(toastTimer);
  toast.classList.remove("visible");
  simulation.reset();
  challenge = null;
  resultDialog.hidden = true;
  eventPage.hidden = true;
  simulationClock.hidden = true;
  startView.hidden = false;
  lastAvailability = null;
  updateSlotAvailability();
}

function showPracticeResult() {
  const result = simulation.result;
  if (!result) return;
  closeReservationFlow();
  resultDialog.setAttribute("data-outcome", result.success ? "success" : "failure");
  document.querySelector("#practice-result-title").textContent = result.success ? "预约成功" : "预约失败";
  document.querySelector("#result-slot").textContent = `${result.date} ${result.time}`;
  const seconds = (milliseconds) => `${(milliseconds / 1000).toFixed(3)} 秒`;
  document.querySelector("#result-total").textContent = seconds(result.totalMs);
  document.querySelector("#result-slot-time").textContent = seconds(result.slotMs);
  document.querySelector("#result-captcha-time").textContent = seconds(result.captchaMs);
  dimmer.hidden = false;
  resultDialog.hidden = false;
}

function cancelCaptchaTimers() {
  window.clearTimeout(verificationTimer);
  window.clearTimeout(errorResetTimer);
  window.clearTimeout(completionTimer);
}

function setCaptchaState(state) {
  captchaState = state;
  captchaDialog.setAttribute("data-state", state);
  captchaPicture.setAttribute("aria-busy", String(state === "checking"));
  captchaStatus.hidden = state !== "checking" && state !== "success";
  captchaStatusMessage.textContent = state === "checking" ? "正在验证" : state === "success" ? "验证成功！" : "";
  confirmCaptcha.disabled = state !== "selecting";
  refreshCaptcha.disabled = state === "checking" || state === "success";
  if (state === "success") captchaDialog.classList.add("is-success");
  else captchaDialog.classList.remove("is-success");
}

// Visible artwork bounds, excluding transparent padding. SVG bounds include the stroke.
const glyphBounds = {
  'digit-0': [192, 192, 22, 15, 147, 162],
  'digit-1': [192, 192, 52, 15, 88, 162],
  'digit-2': [100, 130, 17, 6.878, 67, 113.122],
  'digit-3': [100, 130, 19, 8.236, 71.188, 115.433],
  'digit-4': [192, 192, 40, 15, 113, 162],
  'digit-5': [100, 130, 14, 12, 75.37, 115.854],
  'digit-6': [100, 130, 18.811, 10.389, 73.243, 111.042],
  'digit-7': [192, 192, 42, 15, 107, 162],
  'digit-8': [100, 130, 16, 8, 72, 121],
  'digit-9': [192, 192, 45, 15, 102, 162],
  chartGrowth: [192, 192, 15, 16, 162, 160],
  locationRoute: [192, 192, 20, 11, 152, 132],
  dashboard: [192, 192, 28, 15, 136, 162],
  templeRoof: [192, 192, 23, 33, 146, 137],
  towerDome: [192, 192, 18, 15, 156, 162],
  octocat: [192, 192, 23, 15, 147, 162],
  castle: [192, 192, 22, 15, 148, 153]
};

function glyphMetrics(token) {
  return glyphBounds[token.id] || [192, 192, 15, 15, 162, 162];
}

function glyphImageMarkup(token) {
  const [width, height, x, y, visibleWidth, visibleHeight] = glyphMetrics(token);
  return `<img src="${token.src}" alt="" draggable="false" style="width:${width / visibleWidth * 100}%;height:${height / visibleHeight * 100}%;left:${-x / visibleWidth * 100}%;top:${-y / visibleHeight * 100}%">`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2100);
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function randomBackground() {
  const choices = [fallbackBackground, ...readyBackgrounds].filter((path) => path !== previousBackground);
  if (!choices.length) return fallbackBackground;
  const next = choices[Math.floor(Math.random() * choices.length)];
  previousBackground = next;
  return next;
}

async function preloadBackgrounds() {
  for (const src of shuffled(backgroundPool)) {
    try {
      await loadImage(src);
      readyBackgrounds.add(src);
    } catch {
      // The embedded background keeps the challenge usable when a request fails.
    }
  }
}

function loadImage(src) {
  if (!imageLoads.has(src)) {
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = window.setTimeout(() => finish(new Error(`图片加载超时：${src}`)), imageLoadTimeoutMs);
      image.onload = () => {
        if (image.decode) image.decode().then(() => finish(), () => finish());
        else finish();
      };
      image.onerror = () => finish(new Error(`图片加载失败：${src}`));
      image.src = src;
    });
    imageLoads.set(src, pending);
    pending.catch(() => {
      if (imageLoads.get(src) === pending) imageLoads.delete(src);
    });
  }
  return imageLoads.get(src);
}

function randomPromptPattern() {
  const totalWeight = promptPatterns.reduce((total, pattern) => total + pattern.weight, 0);
  let draw = Math.random() * totalWeight;

  for (const pattern of promptPatterns) {
    draw -= pattern.weight;
    if (draw < 0) return pattern;
  }

  return promptPatterns[promptPatterns.length - 1];
}

function takeRandom(pool, count) {
  return shuffled(pool).slice(0, count).map((token) => ({ ...token }));
}

function makeChallenge() {
  const pattern = randomPromptPattern();
  const targetTokens = shuffled([
    ...takeRandom(digitPool, pattern.digits),
    ...takeRandom(iconPool, pattern.icons)
  ]);
  const boardComposition = pattern.digits === 3
    ? { digits: 3, icons: 2 }
    : { digits: 2, icons: 3 };
  const usedIds = new Set(targetTokens.map((token) => token.id));
  const boardTokens = [...targetTokens];

  const fillFrom = (pool, count) => {
    const available = pool.filter((token) => !usedIds.has(token.id));
    const additions = takeRandom(available, count);
    additions.forEach((token) => usedIds.add(token.id));
    boardTokens.push(...additions);
  };

  fillFrom(digitPool, boardComposition.digits - pattern.digits);
  fillFrom(iconPool, boardComposition.icons - pattern.icons);

  const placedTokens = shuffled(boardTokens);
  const placed = [];

  placedTokens.forEach((token) => {
    let x = 0.5;
    let y = 0.5;
    let attempts = 0;
    do {
      x = 0.1 + Math.random() * 0.8;
      y = 0.15 + Math.random() * 0.7;
      attempts += 1;
    } while (attempts < 120 && placed.some((point) => Math.hypot(point.x - x, point.y - y) < 0.2));
    placed.push({ x, y });
    token.x = x;
    token.y = y;
    token.rotation = Math.round(-30 + Math.random() * 60);
  });

  return {
    background: randomBackground(),
    boardTokens: placedTokens,
    targetIds: targetTokens.map((token) => token.id)
  };
}

function tokenMarkup(token, prompt = false) {
  const className = prompt ? "prompt-token" : "captcha-token";
  const [, , , , width, height] = glyphMetrics(token);
  return `<span class="${className} captcha-glyph" style="--glyph-ratio:${width / height}" aria-hidden="true">${glyphImageMarkup(token)}</span>`;
}

function renderChallenge(nextChallenge) {
  cancelCaptchaTimers();
  challenge = nextChallenge;
  selectedPoints = [];
  setCaptchaState("selecting");
  tokenElements.clear();
  captchaFeedback.textContent = "";
  captchaMarks.replaceChildren();
  captchaTokens.replaceChildren();
  captchaScene.src = challenge.background;

  const targetTokens = challenge.targetIds.map((id) => tokenPool.find((token) => token.id === id));
  challengeCode.innerHTML = targetTokens.map((token) => tokenMarkup(token, true)).join("");
  challengeCode.setAttribute("aria-label", `依次点击：${targetTokens.map((token) => token.label).join("、")}`);

  challenge.boardTokens.forEach((token) => {
    const element = document.createElement("span");
    const [, , , , width, height] = glyphMetrics(token);
    element.className = "captcha-token captcha-glyph";
    element.setAttribute("aria-label", token.label);
    element.style.left = `${token.x * 100}%`;
    element.style.top = `${token.y * 100}%`;
    element.style.setProperty("--rotation", `${token.rotation}deg`);
    element.style.setProperty("--glyph-ratio", width / height);
    element.innerHTML = glyphImageMarkup(token);
    tokenElements.set(token.id, element);
    captchaTokens.append(element);
  });
}

function renderMarks() {
  captchaMarks.replaceChildren();
  selectedPoints.forEach((point, index) => {
    const mark = document.createElement("button");
    mark.type = "button";
    mark.className = "click-mark";
    mark.textContent = String(index + 1);
    mark.setAttribute("aria-label", `取消第 ${index + 1} 个点击`);
    mark.style.left = `${point.x * 100}%`;
    mark.style.top = `${point.y * 100}%`;
    mark.addEventListener("click", (event) => {
      event.stopPropagation();
      if (captchaState !== "selecting") return;
      selectedPoints.splice(index, 1);
      renderMarks();
    });
    captchaMarks.append(mark);
  });

  captchaFeedback.textContent = "";
}

function selectPoint(event) {
  if (!challenge || captchaState !== "selecting" || selectedPoints.length >= challenge.targetIds.length) return;
  const rect = captchaPicture.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  const token = tokenAtPoint({ x, y });
  if (!token) {
    captchaFeedback.textContent = "请点击图片中的图标或数字";
    return;
  }
  if (selectedPoints.some((point) => point.id === token.id)) {
    captchaFeedback.textContent = "这个位置已选，可点击编号取消";
    return;
  }
  selectedPoints.push({ x, y, id: token.id });
  renderMarks();
}

function tokenAtPoint(point) {
  const rect = captchaPicture.getBoundingClientRect();
  const candidates = challenge.boardTokens.flatMap((token) => {
    const element = tokenElements.get(token.id);
    if (!element || !element.offsetWidth || !element.offsetHeight) return [];
    const dx = (point.x - token.x) * rect.width;
    const dy = (point.y - token.y) * rect.height;
    const radians = token.rotation * Math.PI / 180;
    const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
    const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
    // Leave room for a fingertip, while selecting the nearest glyph if areas overlap.
    const padding = token.id === "digit-2" ? 22 : 16;
    const minimum = token.id === "digit-2" ? 32 : 28;
    const halfWidth = Math.max(element.offsetWidth / 2 + padding, minimum);
    const halfHeight = Math.max(element.offsetHeight / 2 + padding, minimum);
    if (Math.abs(localX) > halfWidth || Math.abs(localY) > halfHeight) return [];
    return [{ token, distance: (localX / halfWidth) ** 2 + (localY / halfHeight) ** 2 }];
  });
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.token;
}

captchaPicture.addEventListener("click", selectPoint);

function openCaptcha() {
  renderChallenge(makeChallenge());
  captchaDialog.hidden = false;
}

function closeReservationFlow() {
  cancelCaptchaTimers();
  setCaptchaState("selecting");
  captchaDialog.hidden = true;
  slotSheet.hidden = true;
  dimmer.hidden = true;
}

document.querySelector("#open-slots").addEventListener("click", () => {
  if (!simulation.running) return;
  updateSimulationClock();
  dimmer.hidden = false;
  slotSheet.hidden = false;
});

document.querySelector("#close-slots").addEventListener("click", () => {
  closeReservationFlow();
});

document.querySelectorAll(".time-slot").forEach((slot) => {
  slot.addEventListener("click", () => {
    updateSimulationClock();
    if (slot.disabled || !simulation.selectSlot({ date: slot.dataset.date, time: slot.dataset.time })) return;
    document.querySelectorAll(".time-slot").forEach((item) => item.classList.remove("selected"));
    slot.classList.add("selected");
    openCaptcha();
  });
});

refreshCaptcha.addEventListener("click", () => {
  if (captchaState === "checking" || captchaState === "success") return;
  openCaptcha();
});
document.querySelector("#close-captcha").addEventListener("click", closeReservationFlow);

confirmCaptcha.addEventListener("click", () => {
  if (!challenge || captchaState !== "selecting") return;
  if (selectedPoints.length !== challenge.targetIds.length) {
    captchaFeedback.textContent = `请按顺序点击提示中的 3 项（当前 ${selectedPoints.length}/3）`;
    return;
  }

  const submittedChallenge = challenge;
  const correct = selectedPoints.every((point, index) => point.id === challenge.targetIds[index]);
  captchaFeedback.textContent = "";
  setCaptchaState("checking");
  verificationTimer = window.setTimeout(() => {
    if (challenge !== submittedChallenge || captchaDialog.hidden) return;
    if (correct) {
      if (!simulation.finish()) return;
      setCaptchaState("success");
      window.cancelAnimationFrame(clockFrame);
      updateSimulationClock();
      completionTimer = window.setTimeout(showPracticeResult, captchaTiming.success);
      return;
    }

    setCaptchaState("error");
    captchaFeedback.textContent = "验证错误，请重试";
    errorResetTimer = window.setTimeout(() => {
      if (challenge !== submittedChallenge || captchaDialog.hidden) return;
      selectedPoints = [];
      renderMarks();
      setCaptchaState("selecting");
    }, captchaTiming.error);
  }, captchaTiming.checking);
});

document.querySelector("#start-simulation").addEventListener("click", startSimulation);
document.querySelector("#restart-simulation").addEventListener("click", startSimulation);
document.querySelector("#return-start").addEventListener("click", returnToStart);

dimmer.addEventListener("click", () => {
  if (!captchaDialog.hidden || !resultDialog.hidden) return;
  closeReservationFlow();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resultDialog.hidden) closeReservationFlow();
});

updateSlotAvailability();
window.addEventListener("load", preloadBackgrounds, { once: true });
