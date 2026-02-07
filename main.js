const ROUND_SECONDS = 180;
const BOUNCE_ONE_SECONDS = 20;
const BOUNCE_TWO_SECONDS = 10;
const TOTAL_PRINCIPAL_ROUNDS = 6;

const POINTS = {
    PALABRA_CORRECTA: 2,
    PALABRA_TRAMPA: -5,
    PREGUNTA_CORRECTA: 5,
    PREGUNTA_INCORRECTA: -2,
    REBOTE_1_CORRECTA: 2,
    REBOTE_1_INCORRECTA: -3,
    REBOTE_2_CORRECTA: 1,
    REBOTE_2_INCORRECTA: -4,
};

const estados = {
    WELCOME: "WELCOME",
    RULES: "RULES",
    HUB: "HUB",
    PALABRA: "PALABRA",
    PREGUNTA: "PREGUNTA",
    REBOTE1_RACE: "REBOTE1_RACE",
    REBOTE1_READY: "REBOTE1_READY",
    REBOTE1_PLAY: "REBOTE1_PLAY",
    REBOTE2_READY: "REBOTE2_READY",
    REBOTE2_PLAY: "REBOTE2_PLAY",
    INTERMEDIA: "INTERMEDIA",
    RANKING: "RANKING",
};

let equipos = [];
let orden = [];
let palabrasCalientes = [];
let preguntas = [];

const game = {
    estado: estados.WELCOME,
    rondaIndex: 0,
    principalRoundsPlayed: 0,
    equipoPrincipal: null,
    tiempoRonda: ROUND_SECONDS,
    timerRonda: null,
    preguntaActual: null,
    palabraActual: null,
    preguntaPool: [],
    palabraPool: [],
    respuestasBloqueadas: [],
    reboteNivel: 0,
    timerRebote: null,
    tiempoRebote: 0,
    reboteTeams: [],
    reboteCurrentTeam: null,
    reboteSelectedOption: null,
    reboteRaceWinner: null,
    reboteRaceCleanup: null,
    lastOutcomeMessage: "",
    lastOutcomeTeam: "",
    lastOutcomePoints: 0,
    devKeyStreak: 0,
    devKeyTimeout: null,
    devMenuOpen: false,
};

const dom = {
    screen: document.getElementById("screen"),
    controls: document.getElementById("controls"),
    timer: document.getElementById("timer"),
    backBtn: document.getElementById("back-to-rules"),
};

function setState(nextState) {
    game.estado = nextState;
    render();
}

function resetLayout() {
    dom.screen.innerHTML = "";
    dom.controls.innerHTML = "";
    dom.screen.classList.remove("fullscreen", "rules", "hub", "intermedia", "ranking", "rebote");
    dom.backBtn.classList.add("hidden");
    dom.timer.classList.remove("hidden");
}

function render() {
    resetLayout();
    if (game.estado !== estados.HUB) {
        game.devMenuOpen = false;
    }

    switch (game.estado) {
        case estados.WELCOME:
            renderWelcome();
            break;
        case estados.RULES:
            renderRules();
            break;
        case estados.HUB:
            renderHub();
            break;
        case estados.PALABRA:
            renderPalabra();
            break;
        case estados.PREGUNTA:
            renderPregunta();
            break;
        case estados.REBOTE1_RACE:
            stopMainTimer();
            renderRebote1Race();
            break;
        case estados.REBOTE1_READY:
            stopMainTimer();
            renderRebote1Ready();
            break;
        case estados.REBOTE1_PLAY:
            stopMainTimer();
            renderRebote1Play();
            break;
        case estados.REBOTE2_READY:
            stopMainTimer();
            renderRebote2Ready();
            break;
        case estados.REBOTE2_PLAY:
            stopMainTimer();
            renderRebote2Play();
            break;
        case estados.INTERMEDIA:
            renderIntermedia();
            break;
        case estados.RANKING:
            renderRanking();
            break;
        default:
            throw new Error(`Estado no soportado: ${game.estado}`);
    }
}

function renderWelcome() {
    dom.screen.classList.add("fullscreen");
    dom.timer.classList.add("hidden");

    dom.screen.innerHTML = `
    <div class="welcome-card">
      <h1><span class="welcome-title">¡Bienvenidos!</span></h1>
      <p class="subtitle">Preparad los equipos para empezar la partida.</p>
      <div class="dev-badge">Por David Wei, David López y Rodrigo García</div>
      <input placeholder="Equipo 1" maxlength="40" />
      <input placeholder="Equipo 2" maxlength="40" />
      <input placeholder="Equipo 3" maxlength="40" />
      <div id="error" class="welcome-error"></div>
    </div>
  `;

    const continueBtn = addButton("Siguiente", "blue");
    continueBtn.disabled = true;

    const inputs = dom.screen.querySelectorAll("input");
    const error = dom.screen.querySelector("#error");

    const syncValidity = () => {
        const names = [...inputs].map((input) => input.value.trim());
        const allFilled = names.every((name) => name.length > 0);
        const uniques = new Set(names.map((n) => n.toLowerCase()));
        const allUnique = uniques.size === 3;

        continueBtn.disabled = !(allFilled && allUnique);

        if (!allFilled) {
            error.textContent = "Debes introducir los tres nombres";
        } else if (!allUnique) {
            error.textContent = "Los nombres de equipo no pueden repetirse";
        } else {
            error.textContent = "";
        }
    };

    inputs.forEach((input) => input.addEventListener("input", syncValidity));

    continueBtn.addEventListener("click", () => {
        equipos = [...inputs].map((input) => ({ nombre: input.value.trim(), puntos: 0 }));
        orden = [0, 1, 2].sort(() => Math.random() - 0.5);
        setState(estados.RULES);
    });
}

function renderRules() {
    dom.screen.classList.add("rules");
    dom.timer.classList.add("hidden");

    dom.screen.innerHTML = `
    <h2 class="rules-title">Normas del juego</h2>
    <div class="rules-grid">
      <article class="rule-card">
        <h3>⏱️ Rondas</h3>
        <p>Cada equipo juega como principal durante <strong>3:00</strong>.</p>
        <p>Se completan <strong>2 superrondas</strong> (6 turnos principales en total).</p>
      </article>
      <article class="rule-card">
        <h3>🔥 Palabra caliente</h3>
        <p>✔ Correcta: <strong>+2</strong></p>
        <p>🚨 Trampa: <strong>−5</strong></p>
      </article>
      <article class="rule-card">
        <h3>❓ Pregunta</h3>
        <p>✔ Correcta: <strong>+5</strong></p>
        <p>✖ Incorrecta: <strong>−2</strong> y activa rebotes</p>
      </article>
      <article class="rule-card">
        <h3>⚡ Rebotes</h3>
        <p>Rebote 1 (20s): <strong>+2 / −3</strong></p>
        <p>Rebote 2 (10s): <strong>+1 / −4</strong></p>
      </article>
      <article class="rule-card full-width">
        <h3>🔁 Orden de equipos principales</h3>
        <p>${orden.map((idx) => equipos[idx].nombre).join(" → ")}</p>
      </article>
    </div>
  `;

    addButton("Empezar juego", "green", startRound);
}

function renderHub() {
    stopMainTimer();
    dom.backBtn.classList.remove("hidden");
    dom.screen.classList.add("hub");

    const principal = equipos[game.equipoPrincipal];
    const secundarios = equipos
        .map((equipo, idx) => ({ equipo, idx }))
        .filter(({ idx }) => idx !== game.equipoPrincipal);

    dom.screen.innerHTML = `
    <p class="badge">Superronda ${Math.floor(game.principalRoundsPlayed / 3) + 1} · Turno ${game.principalRoundsPlayed + 1}/${TOTAL_PRINCIPAL_ROUNDS}</p>
    <h2>${principal.nombre} (Principal)</h2>
    <p class="principal-score">Puntos: <strong data-team-points="${game.equipoPrincipal}">${principal.puntos}</strong></p>
    <hr>
    ${secundarios
        .map(
            ({ equipo, idx }) =>
                `<p>${equipo.nombre}: <strong data-team-points="${idx}">${equipo.puntos}</strong></p>`,
        )
        .join("")}
  `;

    addButton("🔥 Palabra caliente", "green", () => {
        startMainTimer();
        setState(estados.PALABRA);
    });

    addButton("❓ Pregunta", "orange", () => {
        startMainTimer();
        setState(estados.PREGUNTA);
    });

    if (game.devMenuOpen) {
        openDevMenu();
    }
}

function renderPalabra() {
    if (!game.palabraActual) {
        game.palabraActual = drawRandomPalabra();
    }
    if (!game.palabraActual) {
        dom.screen.innerHTML = `
      <h2>No quedan palabras calientes</h2>
      <p>Has usado todas las palabras disponibles en esta partida.</p>
    `;
        addButton("Volver al HUB", "blue", () => setState(estados.HUB));
        return;
    }

    const palabra = game.palabraActual;
    const principal = equipos[game.equipoPrincipal];

    dom.screen.innerHTML = `
    <div class="question-head">
      <p class="state-chip">Palabra caliente</p>
      <h2 class="team-focus">${principal.nombre}</h2>
    </div>
    <article class="question-card fill-card palabra-card">
      <div class="palabra-objetivo">${palabra.palabra}</div>
      <div class="prohibidas-header">🚫 Palabras prohibidas</div>
      <div class="prohibidas-list">
        ${palabra.prohibidas.map((p) => `<span class="prohibidas-item">• ${p}</span>`).join("")}
      </div>
    </article>
  `;

    addButton("✔ Correcta (+2)", "green", () => {
        resolveResultado(principal.nombre, `ha acertado “Palabra caliente” y suma ${POINTS.PALABRA_CORRECTA} puntos.`, POINTS.PALABRA_CORRECTA);
    });
    addButton("🚨 Trampa (−5)", "purple", () => {
        resolveResultado(principal.nombre, `ha hecho trampa y pierde ${Math.abs(POINTS.PALABRA_TRAMPA)} puntos.`, POINTS.PALABRA_TRAMPA);
    });
}

function renderPregunta() {
    game.preguntaActual = drawRandomPregunta();
    if (!game.preguntaActual) {
        dom.screen.innerHTML = `
      <h2>No quedan preguntas</h2>
      <p>Has usado todas las preguntas disponibles en esta partida.</p>
    `;
        addButton("Volver al HUB", "blue", () => setState(estados.HUB));
        return;
    }
    let selectedOption = null;
    const principal = equipos[game.equipoPrincipal];

    dom.screen.innerHTML = `
    <div class="question-head">
      <p class="state-chip">Turno de pregunta</p>
      <h2 class="team-focus">${principal.nombre}</h2>
    </div>
    <article class="question-card">
      <h3>${game.preguntaActual.texto}</h3>
    </article>
    <div class="options-wrap options-wrap-lg">
      ${game.preguntaActual.opciones
        .map((opcion, index) => `<button class="action blue opcion" data-index="${index}"><span class="option-tag">${String.fromCharCode(65 + index)}</span>${opcion}</button>`)
        .join("")}
    </div>
    <p id="selection-status" class="selection-status">Selecciona una opción y valida.</p>
  `;

    const optionButtons = dom.screen.querySelectorAll(".opcion");
    optionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectedOption = Number(button.dataset.index);
            optionButtons.forEach((item) => item.classList.remove("selected"));
            button.classList.add("selected");
            dom.screen.querySelector("#selection-status").textContent = `Opción elegida: ${game.preguntaActual.opciones[selectedOption]}`;
        });
    });

    addButton("Validar respuesta", "blue", () => {
        if (selectedOption === null) {
            dom.screen.querySelector("#selection-status").textContent = "Debes seleccionar una opción antes de validar.";
            return;
        }

        if (selectedOption === game.preguntaActual.correcta) {
            resolveResultado(principal.nombre, `ha acertado la pregunta y suma ${POINTS.PREGUNTA_CORRECTA} puntos.`, POINTS.PREGUNTA_CORRECTA);
            return;
        }

        equipos[game.equipoPrincipal].puntos += POINTS.PREGUNTA_INCORRECTA;
        game.lastOutcomeMessage = `${principal.nombre} ha fallado la pregunta y pierde ${Math.abs(POINTS.PREGUNTA_INCORRECTA)} puntos. Se activa Rebote 1.`;
        game.lastOutcomeTeam = principal.nombre;
        game.lastOutcomePoints = POINTS.PREGUNTA_INCORRECTA;

        game.respuestasBloqueadas = [selectedOption];
        game.reboteNivel = 1;
        game.reboteTeams = equipos.map((_, idx) => idx).filter((idx) => idx !== game.equipoPrincipal);
        game.reboteCurrentTeam = null;
        game.reboteRaceWinner = null;
        setState(estados.REBOTE1_RACE);
    });
}

function renderRebote1Race() {
    dom.screen.classList.add("rebote");
    const leftTeam = game.reboteTeams[0];
    const rightTeam = game.reboteTeams[1];

    dom.screen.innerHTML = `
    <div class="rebote-head">
      <h2>Equipos compiten por el rebote</h2>
      <span class="timer-pill">20s</span>
    </div>
    <article class="event-card danger fill-card">
      <h3>${game.lastOutcomeTeam}</h3>
      <p>${game.lastOutcomeMessage}</p>
      <p class="points-delta">${formatDelta(game.lastOutcomePoints)}</p>
    </article>
    <p id="race-status" class="race-status">Pulsa primero para ganar el rebote.</p>
    <div class="duel-grid">
      <article class="duel-card">
        <h4>${equipos[leftTeam].nombre}</h4>
        <p>Pulsa <kbd>Ctrl Izq</kbd></p>
      </article>
      <article class="duel-card">
        <h4>${equipos[rightTeam].nombre}</h4>
        <p>Pulsa <kbd>Enter NumPad</kbd></p>
      </article>
    </div>
      `;

    const onRaceKey = (event) => {
        if (game.reboteRaceWinner !== null) return;

        if (event.code === "ControlLeft") {
            game.reboteRaceWinner = leftTeam;
        } else if (event.code === "NumpadEnter") {
            game.reboteRaceWinner = rightTeam;
        } else {
            return;
        }

        game.reboteCurrentTeam = game.reboteRaceWinner;
        game.lastOutcomeTeam = equipos[game.reboteCurrentTeam].nombre;
        game.lastOutcomePoints = 0;
        game.lastOutcomeMessage = `${game.lastOutcomeTeam} ha ganado el rebote. Tiene 20 segundos para responder.`;
        window.removeEventListener("keydown", onRaceKey);
        setState(estados.REBOTE1_READY);
    };

    window.addEventListener("keydown", onRaceKey);
    game.reboteRaceCleanup = () => window.removeEventListener("keydown", onRaceKey);
}

function renderRebote1Ready() {
    dom.screen.classList.add("rebote");
    dom.screen.innerHTML = `
    <h2 class="rebote-title">REBOTE 1</h2>
    <article class="event-card info fill-card rebote-announce">
      <p class="rebote-message">${game.lastOutcomeMessage}</p>
    </article>
  `;

    addButton("Continuar", "blue", () => setState(estados.REBOTE1_PLAY));
}

function renderRebote1Play() {
    dom.screen.classList.add("rebote");
    dom.screen.innerHTML = `
    <div class="rebote-head">
      <h2>REBOTE 1</h2>
      <span id="rebote-timer" class="timer-pill">20s</span>
    </div>
    <article class="question-card">
      <h3>${game.preguntaActual.texto}</h3>
    </article>
    <div class="options-wrap options-wrap-lg">
      ${renderBlockedOptions()}
    </div>
    <p id="selection-status" class="selection-status">Selecciona una opción y valida.</p>
  `;

    bindReboteOptions(true);
    controlsForReboteValidation();

    startBounceTimer(BOUNCE_ONE_SECONDS, () => {
        const teamName = equipos[game.reboteCurrentTeam].nombre;
        equipos[game.reboteCurrentTeam].puntos += POINTS.REBOTE_1_INCORRECTA;
        game.lastOutcomeTeam = teamName;
        game.lastOutcomePoints = POINTS.REBOTE_1_INCORRECTA;
        game.lastOutcomeMessage = `${teamName} no respondió a tiempo y pierde ${Math.abs(POINTS.REBOTE_1_INCORRECTA)} puntos. Pasa al Rebote 2.`;
        const otherTeam = game.reboteTeams.find((idx) => idx !== game.reboteCurrentTeam);
        game.reboteNivel = 2;
        game.reboteCurrentTeam = otherTeam;
        setState(estados.REBOTE2_READY);
    });
}

function renderRebote2Ready() {
    dom.screen.classList.add("rebote");
    dom.screen.innerHTML = `
    <h2 class="rebote-title">REBOTE 2</h2>
    <article class="event-card info fill-card rebote-announce">
      <p class="rebote-message">${game.lastOutcomeMessage}</p>
      <p>Tienes 10 segundos para responder.</p>
    </article>
  `;

    addButton("Continuar", "blue", () => setState(estados.REBOTE2_PLAY));
}

function renderRebote2Play() {
    dom.screen.classList.add("rebote");
    dom.screen.innerHTML = `
    <div class="rebote-head">
      <h2>REBOTE 2</h2>
      <span id="rebote-timer" class="timer-pill">10s</span>
    </div>
    <article class="question-card">
      <h3>${game.preguntaActual.texto}</h3>
    </article>
    <div class="options-wrap options-wrap-lg">
      ${renderBlockedOptions()}
    </div>
    <p id="selection-status" class="selection-status">Selecciona una opción y valida.</p>
  `;

    bindReboteOptions(true);
    controlsForReboteValidation();

    startBounceTimer(BOUNCE_TWO_SECONDS, () => {
        const teamName = equipos[game.reboteCurrentTeam].nombre;
        equipos[game.reboteCurrentTeam].puntos += POINTS.REBOTE_2_INCORRECTA;
        game.lastOutcomeTeam = teamName;
        game.lastOutcomePoints = POINTS.REBOTE_2_INCORRECTA;
        game.lastOutcomeMessage = `${teamName} no respondió a tiempo y pierde ${Math.abs(POINTS.REBOTE_2_INCORRECTA)} puntos.`;
        setState(estados.INTERMEDIA);
    });
}

function renderBlockedOptions() {
    return game.preguntaActual.opciones
        .map((opcion, index) => {
            if (game.respuestasBloqueadas.includes(index)) {
                return `<button class="action disabled blocked" disabled><span class="option-tag">✖</span>${opcion}</button>`;
            }
            return `<button class="action blue opcion" data-index="${index}"><span class="option-tag">${String.fromCharCode(65 + index)}</span>${opcion}</button>`;
        })
        .join("");
}

function bindReboteOptions(canSelect) {
    game.reboteSelectedOption = null;
    const buttons = dom.screen.querySelectorAll(".opcion");
    buttons.forEach((button) => {
        button.disabled = !canSelect;
        button.addEventListener("click", () => {
            if (!canSelect) return;
            game.reboteSelectedOption = Number(button.dataset.index);
            buttons.forEach((item) => item.classList.remove("selected"));
            button.classList.add("selected");
            document.getElementById("selection-status").textContent = `Opción elegida: ${game.preguntaActual.opciones[game.reboteSelectedOption]}`;
        });
    });
}

function controlsForReboteValidation() {
    dom.controls.innerHTML = "";
    addButton("Validar rebote", "orange", () => {
        if (game.reboteSelectedOption === null) {
            document.getElementById("selection-status").textContent = "Selecciona una opción antes de validar.";
            return;
        }
        resolveBounce(game.reboteSelectedOption);
    });
}

function renderIntermedia() {
    dom.screen.classList.add("intermedia");
    dom.screen.innerHTML = `
    <h2>Resultado de la jugada</h2>
    <article class="event-card ${getOutcomeClass(game.lastOutcomePoints)} fill-card">
      <p class="outcome">${game.lastOutcomeMessage}</p>
      <p class="points-delta">${formatDelta(game.lastOutcomePoints)}</p>
    </article>
  `;

    addButton("Continuar", "blue", () => setState(estados.HUB));
}

function renderRanking() {
    dom.screen.classList.add("ranking");
    const ranking = [...equipos].sort((a, b) => b.puntos - a.puntos);

    dom.screen.innerHTML = `
    <h2>🏆 Clasificación final</h2>
    <div class="ranking-list">
      ${ranking
        .map(
            (equipo, index) => `
          <article class="ranking-item">
            <h3>${index + 1}. ${equipo.nombre}</h3>
            <p>${equipo.puntos} puntos</p>
          </article>
        `,
        )
        .join("")}
    </div>
  `;

    addButton("Jugar otra vez", "green", resetGame);
}

function addButton(text, colorClass, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = `action ${colorClass}`;
    if (onClick) button.addEventListener("click", onClick);
    dom.controls.appendChild(button);
    return button;
}

function updateMainTimer() {
    const minutes = String(Math.floor(game.tiempoRonda / 60)).padStart(2, "0");
    const seconds = String(game.tiempoRonda % 60).padStart(2, "0");
    dom.timer.textContent = `${minutes}:${seconds}`;
}

function startMainTimer() {
    if (game.timerRonda) return;

    game.timerRonda = setInterval(() => {
        game.tiempoRonda -= 1;
        updateMainTimer();

        if (game.tiempoRonda <= 0) {
            changePrincipalTeam();
        }
    }, 1000);
}

function stopMainTimer() {
    if (game.timerRonda) {
        clearInterval(game.timerRonda);
        game.timerRonda = null;
    }
}

function startBounceTimer(seconds, onEnd) {
    stopBounceTimer();
    game.tiempoRebote = seconds;
    const timerEl = document.getElementById("rebote-timer");
    timerEl.textContent = `${game.tiempoRebote}s`;

    game.timerRebote = setInterval(() => {
        game.tiempoRebote -= 1;
        timerEl.textContent = `${game.tiempoRebote}s`;

        if (game.tiempoRebote <= 0) {
            stopBounceTimer();
            if (typeof onEnd === "function") onEnd();
        }
    }, 1000);
}

function stopBounceTimer() {
    if (game.timerRebote) {
        clearInterval(game.timerRebote);
        game.timerRebote = null;
    }
    if (typeof game.reboteRaceCleanup === "function") {
        game.reboteRaceCleanup();
        game.reboteRaceCleanup = null;
    }
}

function handleDevKey(event) {
    if (game.estado !== estados.HUB || game.devMenuOpen) {
        return;
    }

    if (event.code !== "KeyD") {
        game.devKeyStreak = 0;
        return;
    }

    game.devKeyStreak += 1;
    if (game.devKeyTimeout) clearTimeout(game.devKeyTimeout);
    game.devKeyTimeout = setTimeout(() => {
        game.devKeyStreak = 0;
    }, 800);

    if (game.devKeyStreak >= 3) {
        game.devKeyStreak = 0;
        openDevMenu();
    }
}

function openDevMenu() {
    if (game.devMenuOpen || game.estado !== estados.HUB) return;
    game.devMenuOpen = true;

    const overlay = document.createElement("div");
    overlay.className = "dev-overlay";
    overlay.innerHTML = `
    <div class="dev-modal" role="dialog" aria-modal="true">
      <button class="dev-close" type="button" aria-label="Cerrar">✕</button>
      <h3>Menú de rectificación</h3>
      <label class="dev-label">
        Equipo
        <select class="dev-select">
          ${equipos.map((equipo, idx) => `<option value="${idx}">${equipo.nombre}</option>`).join("")}
        </select>
      </label>
      <div class="dev-actions">
        <button type="button" class="dev-btn dev-add" data-delta="1">+1</button>
        <button type="button" class="dev-btn dev-add" data-delta="3">+3</button>
        <button type="button" class="dev-btn dev-add" data-delta="5">+5</button>
        <button type="button" class="dev-btn dev-sub" data-delta="-1">−1</button>
        <button type="button" class="dev-btn dev-sub" data-delta="-3">−3</button>
        <button type="button" class="dev-btn dev-sub" data-delta="-5">−5</button>
      </div>
    </div>
  `;

    overlay.querySelector(".dev-close").addEventListener("click", () => {
        game.devMenuOpen = false;
        overlay.remove();
    });

    overlay.querySelector(".dev-actions").addEventListener("click", (event) => {
        const button = event.target.closest(".dev-btn");
        if (!button) return;
        const delta = Number(button.dataset.delta);
        const select = overlay.querySelector(".dev-select");
        const teamIndex = Number(select.value);
        if (!Number.isFinite(delta) || Number.isNaN(teamIndex)) return;
        equipos[teamIndex].puntos += delta;
        updateHubScores(teamIndex);
    });

    dom.screen.appendChild(overlay);
}

function updateHubScores(teamIndex) {
    dom.screen
        .querySelectorAll(`[data-team-points="${teamIndex}"]`)
        .forEach((node) => {
            node.textContent = equipos[teamIndex].puntos;
        });
}

function resolveResultado(teamName, message, points) {
    stopMainTimer();
    equipos[game.equipoPrincipal].puntos += points;
    game.palabraActual = null;
    game.lastOutcomeTeam = teamName;
    game.lastOutcomePoints = points;
    game.lastOutcomeMessage = `${teamName} ${message}`;
    setState(estados.INTERMEDIA);
}

function resolveBounce(answerIndex) {
    stopBounceTimer();

    const teamIndex = game.reboteCurrentTeam;
    const teamName = equipos[teamIndex].nombre;

    if (answerIndex === game.preguntaActual.correcta) {
        const earned = game.reboteNivel === 1 ? POINTS.REBOTE_1_CORRECTA : POINTS.REBOTE_2_CORRECTA;
        equipos[teamIndex].puntos += earned;
        game.lastOutcomeTeam = teamName;
        game.lastOutcomePoints = earned;
        game.lastOutcomeMessage = `${teamName} ha acertado el Rebote ${game.reboteNivel} y suma ${earned} puntos.`;
        setState(estados.INTERMEDIA);
        return;
    }

    game.respuestasBloqueadas.push(answerIndex);

    if (game.reboteNivel === 1) {
        equipos[teamIndex].puntos += POINTS.REBOTE_1_INCORRECTA;
        const otherTeam = game.reboteTeams.find((idx) => idx !== teamIndex);
        game.reboteNivel = 2;
        game.reboteCurrentTeam = otherTeam;
        game.lastOutcomeTeam = teamName;
        game.lastOutcomePoints = POINTS.REBOTE_1_INCORRECTA;
        game.lastOutcomeMessage = `${teamName} falló en Rebote 1 y pierde ${Math.abs(POINTS.REBOTE_1_INCORRECTA)} puntos. Turno de ${equipos[otherTeam].nombre} en Rebote 2.`;
        setState(estados.REBOTE2_READY);
        return;
    }

    equipos[teamIndex].puntos += POINTS.REBOTE_2_INCORRECTA;
    game.lastOutcomeTeam = teamName;
    game.lastOutcomePoints = POINTS.REBOTE_2_INCORRECTA;
    game.lastOutcomeMessage = `${teamName} falló en Rebote 2 y pierde ${Math.abs(POINTS.REBOTE_2_INCORRECTA)} puntos.`;
    setState(estados.INTERMEDIA);
}

function startRound() {
    game.tiempoRonda = ROUND_SECONDS;
    updateMainTimer();
    game.equipoPrincipal = orden[game.rondaIndex];
    setState(estados.HUB);
}

function changePrincipalTeam() {
    stopMainTimer();
    game.principalRoundsPlayed += 1;

    if (game.principalRoundsPlayed >= TOTAL_PRINCIPAL_ROUNDS) {
        setState(estados.RANKING);
        return;
    }

    game.rondaIndex = (game.rondaIndex + 1) % 3;
    startRound();
}

function resetGame() {
    stopMainTimer();
    stopBounceTimer();
    equipos = [];
    orden = [];
    game.estado = estados.WELCOME;
    game.rondaIndex = 0;
    game.principalRoundsPlayed = 0;
    game.equipoPrincipal = null;
    game.tiempoRonda = ROUND_SECONDS;
    game.preguntaActual = null;
    game.palabraActual = null;
    game.respuestasBloqueadas = [];
    game.reboteNivel = 0;
    game.reboteTeams = [];
    game.reboteCurrentTeam = null;
    game.reboteRaceWinner = null;
    game.lastOutcomeMessage = "";
    game.lastOutcomeTeam = "";
    game.lastOutcomePoints = 0;
    game.preguntaPool = [];
    game.palabraPool = [];
    initPools();
    updateMainTimer();
    render();
}

function getOutcomeClass(points) {
    if (points === POINTS.PALABRA_TRAMPA) return "purple";
    if (points > 0) return "success";
    return "danger";
}

function formatDelta(points) {
    if (points > 0) return `+${points} puntos`;
    if (points < 0) return `${points} puntos`;
    return "0 puntos";
}

function shuffleArray(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initPools() {
    game.preguntaPool = shuffleArray(preguntas);
    game.palabraPool = shuffleArray(palabrasCalientes);
}

function drawRandomPregunta() {
    if (game.preguntaPool.length === 0) {
        return null;
    }
    return game.preguntaPool.pop();
}

function drawRandomPalabra() {
    if (game.palabraPool.length === 0) {
        return null;
    }
    return game.palabraPool.pop();
}

function validateDataOrThrow(payload) {
    if (!payload || !Array.isArray(payload.preguntas) || !Array.isArray(payload.palabrasCalientes)) {
        throw new Error("El JSON no tiene la estructura esperada.");
    }

    payload.preguntas.forEach((p, idx) => {
        if (!p.texto || !Array.isArray(p.opciones) || p.opciones.length !== 4 || typeof p.correcta !== "number") {
            throw new Error(`Pregunta inválida en índice ${idx}.`);
        }
    });

    payload.palabrasCalientes.forEach((p, idx) => {
        if (!p.palabra || !Array.isArray(p.prohibidas) || p.prohibidas.length !== 4) {
            throw new Error(`Palabra caliente inválida en índice ${idx}.`);
        }
    });
}

async function initApp() {
    try {
        const response = await fetch("data/juego.json", { cache: "no-store" });
        const payload = await response.json();
        validateDataOrThrow(payload);
        preguntas = payload.preguntas;
        palabrasCalientes = payload.palabrasCalientes;
        initPools();
        updateMainTimer();
        setState(estados.WELCOME);
    } catch (error) {
        dom.screen.innerHTML = `<h2>Error cargando datos</h2><p>${error.message}</p>`;
    }
}

dom.backBtn.addEventListener("click", () => setState(estados.RULES));
document.addEventListener("keydown", handleDevKey);
initApp();
