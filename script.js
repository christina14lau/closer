const TITLES = [
    "First Impressions",
    "Values & Worldviews",
    "Emotional Intimacy",
    "Love & Relationships",
    "Personal History & Healing",
    "The Future & Deep Connection",
    "Situations & Character",
    "The Unspoken",
    "Adult Intimacy",
    "Bare Minimum or Princess Treatment",
    "Love Language & Personality",
    "Emotional Intelligence",
    "Darker Side of You",
    "Self-Love & Personal Growth"
];

const DESCS = [
    "Easy questions that reveal personality, preferences, and everyday values.",
    "Explore beliefs, priorities, principles, and how you see the world.",
    "Understand emotions, affection, vulnerability, and connection.",
    "Discuss compatibility, boundaries, expectations, and partnership.",
    "Explore formative experiences, lessons, regrets, and your story.",
    "Talk about long-term compatibility, dreams, fears, and shared life.",
    "Hypothetical scenarios to explore how someone thinks and decides.",
    "Deeply personal questions about vulnerability, fears, and inner truths.",
    "Explore physical attraction, sexual compatibility, desires, boundaries, and adult intimacy. 18+ only.",
    "Discuss whether a certain action is basic relationship effort or extra-special treatment.",
    "Explore how you express care, recognize others' needs, and adapt your love language to different people and situations.",
    "Explore self-awareness, empathy, emotional regulation, communication, accountability, and emotional maturity.",
    "Discover parts of ourselves we don't always like to acknowledge: insecurity, jealousy, selfishness, control, resentment, ego, unhealthy patterns, hidden intentions, and the ways we unintentionally hurt others.",
    "Understand self-worth, self-acceptance, confidence, personal identity, healing, independence, growth, and learning to become comfortable with who you are."
];

const SHEET_URL = "https://script.google.com/macros/s/AKfycbx2wUj3WMQv8BXJE0Fne_5S4kathR9X4x2rGSO0_5KlUu6tKWFJRaBWlnnYz0kpbqP6Gw/exec";

// LOCAL STORAGE KEY
const STORAGE_KEY = "closer_progress_v1";

const $ = id => document.getElementById(id);


// LOAD SAVED DATA FROM LOCAL STORAGE
function loadStoredSet(key) {
    try {
        const data = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
        );

        if (!Array.isArray(data[key])) {
            return new Set();
        }

        return new Set(data[key].map(id => String(id)));

    } catch (error) {
        console.error("Unable to load saved progress:", error);
        return new Set();
    }
}


// LOAD SAVED UNDO HISTORY FROM LOCAL STORAGE
function loadUndoHistory() {
    try {
        const data = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
        );

        if (!Array.isArray(data.undoHistory)) {
            return [];
        }

        return data.undoHistory.map(action => ({
            ...action,

            // GIVE OLD ACTIONS A SESSION KEY
            sessionKey: action.sessionKey ||
                (action.randomMode
                    ? `randomizer-${action.sessionId || "legacy"}`
                    : `level-${action.level}`)
        }));

    } catch (error) {
        console.error("Unable to load undo history:", error);
        return [];
    }
}


// GLOBAL VARIABLES
let allQuestions = [];
let level = 1;
let deck = [];
let idx = 0;
let explored = loadStoredSet("explored");
let saved = loadStoredSet("saved");
let current = null;
let randomMode = false;

// UNDO HISTORY AND SESSION TRACKING
let undoHistory = loadUndoHistory();
let activeSessionKey = null;
let inGame = false;


// SAVE PROGRESS TO LOCAL STORAGE
function saveProgress() {
    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                explored: [...explored],
                saved: [...saved],

                // SAVE ALL UNDO HISTORY
                undoHistory: undoHistory,

                // SAVE CURRENT GAME SESSION FOR REFRESHING
                activeSession: inGame
                    ? {
                        sessionKey: activeSessionKey,
                        deckIds: deck.map(q => q.id),
                        index: idx,
                        level: level,
                        randomMode: randomMode
                    }
                    : null
            })
        );

    } catch (error) {
        console.error("Unable to save progress:", error);
    }
}


// START A SESSION
function startNewSession(newSessionKey) {

    // IDENTIFY WHICH LEVEL OR SESSION IS CURRENTLY ACTIVE
    activeSessionKey = newSessionKey;

    inGame = true;

    saveProgress();
}


// END THE CURRENT SESSION
function endSession() {

    // MARK THAT THE USER HAS LEFT THE GAME
    inGame = false;

    // KEEP ALL UNDO HISTORY SAVED
    current = null;
    activeSessionKey = null;

    saveProgress();
}


// RESTORE THE PREVIOUS SESSION AFTER REFRESHING
function restoreSession() {

    try {

        const data = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
        );

        const previousSession = data.activeSession;

        // CHECK IF THERE IS A SAVED SESSION
        if (
            !previousSession ||
            !Array.isArray(previousSession.deckIds)
        ) {
            return false;
        }

        // RESTORE THE SESSION KEY
        activeSessionKey = previousSession.sessionKey ||
            (previousSession.randomMode
                ? `randomizer-${previousSession.sessionId || "legacy"}`
                : `level-${previousSession.level}`);

        // RESTORE THE ORIGINAL QUESTION DECK
        deck = previousSession.deckIds
            .map(id => allQuestions.find(q => q.id === id))
            .filter(q => q !== undefined);

        // DO NOT RESTORE AN EMPTY OR INVALID DECK
        if (deck.length === 0) {
            return false;
        }

        level = previousSession.level;
        randomMode = previousSession.randomMode;

        // RESTORE THE QUESTION POSITION
        idx = Math.max(
            0,
            Math.min(previousSession.index, deck.length)
        );

        current = null;
        inGame = true;

        // RESTORE THE GAME SCREEN
        $("intro").classList.add("hidden");
        $("game").classList.remove("hidden");

        show();

        console.log("Previous session restored.");

        return true;

    } catch (error) {

        console.error("Unable to restore previous session:", error);

        return false;
    }
}


// GET QUESTIONS FROM GOOGLE SHEETS
async function loadQuestions() {

    try {
        const response = await fetch(SHEET_URL);

        if (!response.ok) {
            throw new Error("Unable to load questions.");
        }

        const data = await response.json();

        allQuestions = data
            .filter(q => q.id && q.text && Number(q.level))
            .map(q => ({
                id: String(q.id).trim(),
                level: Number(q.level),
                levelTitle: q.levelTitle || "",
                type: q.type || "standard",
                section: q.section || "",
                text: String(q.text),
                interpretation: q.interpretation || "",
                hint: q.hint || ""
            }));

        if (allQuestions.length === 0) {
            throw new Error("No questions were found in your spreadsheet.");
        }

        // REMOVE SAVED IDs THAT NO LONGER EXIST IN GOOGLE SHEETS
        const validIds = new Set(
            allQuestions.map(q => q.id)
        );

        explored = new Set(
            [...explored].filter(id => validIds.has(id))
        );

        saved = new Set(
            [...saved].filter(id => validIds.has(id))
        );

        // REMOVE INVALID QUESTIONS FROM UNDO HISTORY
        undoHistory = undoHistory.filter(
            action => validIds.has(action.questionId)
        );

        console.log("Questions loaded:", allQuestions.length);
        console.log("Explored questions:", explored.size);
        console.log("Saved questions:", saved.size);
        console.log("Undo history:", undoHistory.length);


        // CHECK FOR DUPLICATE QUESTION IDs
        const seen = new Map();

        allQuestions.forEach(q => {
            if (seen.has(q.id)) {
                console.log("Duplicate ID:", q.id);
                console.log("First question:", seen.get(q.id));
                console.log("Duplicate question:", q.text);
            } else {
                seen.set(q.id, q.text);
            }
        });


        // RESTORE THE PREVIOUS SESSION IF AVAILABLE
        const restored = restoreSession();

        // SAVE CLEANED PROGRESS
        saveProgress();

        // RENDER PAGE
        renderLevels();
        renderSaved();

        if (!restored) {
            $("game").classList.add("hidden");
            $("intro").classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading questions:", error);

        $("levels").textContent =
            "Unable to load questions. Please check your Google Sheets connection.";
    }
}


// GET QUESTIONS FOR A SPECIFIC LEVEL
function qs(n) {
    return allQuestions.filter(q => q.level === n);
}


// GET LEVEL TITLE FROM SHEETS
function titleForLevel(n) {
    const question = qs(n).find(q => q.levelTitle);

    return question
        ? question.levelTitle
        : TITLES[n - 1] || `Level ${n}`;
}


// ESCAPE HTML
function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


// DISPLAY LEVELS
function renderLevels() {

    let root = $("levels");
    root.innerHTML = "";

    // CREATE ALL LEVEL CARDS
    TITLES.forEach((title, i) => {

        let n = i + 1;
        let list = qs(n);

        let done = list.filter(
            q => explored.has(q.id)
        ).length;

        let el = document.createElement("button");
        el.className = "level";

        el.innerHTML = `
            <span class="badge">${n}</span>

            <span class="levcontent">
                <div class="levtitle">
                    Level ${n} — ${titleForLevel(n)}
                    ${n === 9 ? '<span style="color:var(--rose);font-size:9px;"> · 18+</span>' : ''}
                </div>

                <div class="levdesc">${DESCS[i]}</div>

                <div class="mini">
                    <div style="width:${list.length ? done / list.length * 100 : 0}%"></div>
                </div>

                <div class="levmeta">
                    <span>${done} / ${list.length} explored</span>
                    <span>${list.length ? "Open level →" : "Coming soon"}</span>
                </div>
            </span>
        `;

        // DISABLE LEVELS WITHOUT QUESTIONS
        el.disabled = list.length === 0;

        // OPEN SELECTED LEVEL
        el.onclick = () => start(n);

        root.appendChild(el);
    });


    // CREATE RANDOMIZER CARD AFTER ALL LEVELS
    let randomizer = document.createElement("button");
    randomizer.className = "level randomizer";

    randomizer.innerHTML = `
        <span class="badge">♡</span>

        <span class="levcontent">
            <div class="levtitle">Surprise Me</div>

            <div class="levdesc">
                Get a random question from any level that you haven't explored yet.
            </div>

            <div class="levmeta">
                <span>All levels</span>
                <span>Pick a question →</span>
            </div>
        </span>
    `;

    randomizer.onclick = startRandomizer;

    root.appendChild(randomizer);


    // OVERALL PROGRESS
    const exploredCount = allQuestions.filter(
        q => explored.has(q.id)
    ).length;

    $("overallCount").textContent =
        `${exploredCount} / ${allQuestions.length} explored`;

    let percent = allQuestions.length
        ? Math.round(exploredCount / allQuestions.length * 100)
        : 0;

    $("percent").textContent = percent + "%";

    $("overallFill").style.width = percent + "%";
    $("overallFill").classList.remove("loading-bar");


    // UPDATE HOMEPAGE QUESTION COUNT
    const footnote = $("questionCount");

    if (footnote) {
        footnote.textContent =
            `${allQuestions.length} questions · ${TITLES.length} levels`;
    }
}


// START A LEVEL
function start(n) {

    // REUSE THE SAME UNDO HISTORY FOR THIS LEVEL
    startNewSession(`level-${n}`);

    randomMode = false;
    level = n;

    deck = qs(n);

    // RESUME FROM FIRST UNEXPLORED QUESTION
    idx = deck.findIndex(
        q => !explored.has(q.id)
    );

    // IF EVERYTHING IS EXPLORED, SHOW COMPLETION
    if (idx === -1) {
        idx = deck.length;
    }

    current = null;

    closeSavedModal();

    $("intro").classList.add("hidden");
    $("game").classList.remove("hidden");

    show();
}


// START RANDOMIZER WITH UNEXPLORED QUESTIONS FROM EVERY LEVEL
function startRandomizer() {

    // GIVE EACH RANDOMIZER RUN ITS OWN HISTORY
    startNewSession(`randomizer-${Date.now()}`);

    randomMode = true;

    // ONLY INCLUDE QUESTIONS THAT HAVE NOT BEEN MARKED EXPLORED
    deck = allQuestions.filter(
        q => !explored.has(q.id)
    );

    // SHUFFLE THE QUESTIONS INTO A RANDOM ORDER
    for (let i = deck.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    idx = 0;
    current = null;

    closeSavedModal();

    $("intro").classList.add("hidden");
    $("game").classList.remove("hidden");

    show();
}


// DISPLAY CURRENT QUESTION
function show() {

    // UPDATE UNDO BUTTON
    const undoButton = $("undo");

    if (undoButton) {

        // ONLY ENABLE UNDO IF THE CURRENT SESSION HAS HISTORY
        undoButton.disabled = !undoHistory.some(
            action => action.sessionKey === activeSessionKey
        );
    }


    // CHECK IF LEVEL OR RANDOMIZER IS COMPLETE
    if (idx >= deck.length) {

        current = null;

        let completed = deck.filter(
            q => explored.has(q.id)
        ).length;

        $("question").textContent = randomMode
            ? "You've reached the end of this random session!"
            : (completed === deck.length
                ? "You've explored every question in this level."
                : "You've reached the end of this level.");

        $("hint").textContent = randomMode
            ? "Return to all levels or start the randomizer again. Any questions you passed will still be available."
            : "Return to all levels to choose another deck or revisit saved questions.";

        $("number").textContent = "♡";

        $("pill").textContent = randomMode
            ? "RANDOMIZER COMPLETE"
            : `LEVEL ${level} COMPLETE`;

        $("round").textContent = randomMode
            ? "RANDOMIZER COMPLETE"
            : "LEVEL COMPLETE";

        $("progress").style.width =
            deck.length
                ? (randomMode
                    ? (idx / deck.length)
                    : (completed / deck.length)) * 100 + "%"
                : "0%";

        $("levelProgress").textContent = randomMode
            ? `${completed} / ${deck.length} explored in this random session`
            : `${completed} / ${deck.length} explored in this level`;

        $("next").textContent = "Back to levels ↗";

        $("save").classList.add("hidden");
        $("interpretation").classList.add("hidden");

        renderSaved();

        // SAVE THE CURRENT SESSION POSITION
        saveProgress();

        return;
    }


    // GET CURRENT QUESTION
    current = deck[idx];

    // DISPLAY THE QUESTION'S CATEGORY IN RANDOMIZER MODE
    if (randomMode) {
        level = current.level;
    }

    $("question").textContent = current.text;

    $("hint").textContent = current.hint ||
        (current.section
            ? `Section: ${current.section}. Take turns answering. You can always pass.`
            : "Take turns answering. You can always pass.");

    $("number").textContent =
        String(idx + 1).padStart(2, "0");


    // QUESTION LABELS
    let typeLabel = current.type !== "standard"
        ? ` · ${current.type.toUpperCase()}`
        : "";

    let adultLabel = level === 9 ? " · 18+" : "";

    $("round").textContent = randomMode
        ? `RANDOMIZER · QUESTION ${String(idx + 1).padStart(2, "0")} OF ${deck.length}`
        : `LEVEL ${level}${typeLabel}${adultLabel} · QUESTION ${String(idx + 1).padStart(2, "0")}`;

    let sectionLabel = current.section
        ? ` · ${current.section}`
        : "";

    $("pill").textContent = randomMode
        ? `RANDOM PICK — LEVEL ${level}: ${titleForLevel(level).toUpperCase()}${sectionLabel}${adultLabel}`
        : `LEVEL ${level} — ${titleForLevel(level).toUpperCase()}${sectionLabel}${adultLabel}`;


    // PROGRESS BASED ON ACTUALLY EXPLORED QUESTIONS OR RANDOM SESSION POSITION
    let completed = deck.filter(
        q => explored.has(q.id)
    ).length;

    $("progress").style.width =
        deck.length
            ? (randomMode
                ? (idx + 1) / deck.length
                : completed / deck.length) * 100 + "%"
            : "0%";

    $("levelProgress").textContent = randomMode
        ? `${idx + 1} / ${deck.length} questions in this random session`
        : `${completed} / ${deck.length} explored in this level`;


    // UPDATE SAVE BUTTON
    $("save").classList.remove("hidden");

    $("save").textContent =
        saved.has(current.id) ? "♥" : "♡";


    // UPDATE NEXT BUTTON
    $("next").textContent =
        explored.has(current.id)
            ? "Next question →"
            : "Mark explored →";


    // INTERPRETATION
    if (current.interpretation) {

        $("interpretation").textContent = current.interpretation;
        $("interpretation").classList.remove("hidden");

    } else {

        $("interpretation").classList.add("hidden");
    }


    renderSaved();

    // SAVE THE CURRENT SESSION POSITION
    saveProgress();
}


// RECORD QUESTION ACTIONS FOR UNDO
function recordUndo(action) {

    if (!current) return;

    undoHistory.push({
        questionId: current.id,
        action: action,
        wasExplored: explored.has(current.id),

        // REMEMBER THE ORIGINAL QUESTION DECK
        deckIds: deck.map(q => q.id),
        index: idx,
        level: level,
        randomMode: randomMode,

        // IDENTIFY WHICH LEVEL OR SESSION THIS ACTION BELONGS TO
        sessionKey: activeSessionKey
    });

    // LIMIT HISTORY TO PREVENT UNLIMITED STORAGE GROWTH
    if (undoHistory.length > 100) {
        undoHistory.shift();
    }

    saveProgress();
}


// MOVE TO NEXT QUESTION
function advance() {

    if (!current) {

        // LEAVE THE CURRENT SESSION
        endSession();

        $("game").classList.add("hidden");
        $("intro").classList.remove("hidden");

        renderLevels();
        renderSaved();

        return;
    }

    // RECORD THE ACTION BEFORE CHANGING PROGRESS
    recordUndo("completed");

    // MARK QUESTION AS EXPLORED
    explored.add(current.id);

    saveProgress();

    idx++;

    // SKIP QUESTIONS THAT HAVE ALREADY BEEN ANSWERED
    while (
        idx < deck.length &&
        explored.has(deck[idx].id)
    ) {
        idx++;
    }

    show();

    renderLevels();
}


// UNDO THE MOST RECENT QUESTION ACTION IN THE CURRENT SESSION
function undo() {

    // ONLY FIND ACTIONS FROM THE CURRENT SESSION
    let historyIndex = undoHistory.length - 1;

    while (
        historyIndex >= 0 &&
        undoHistory[historyIndex].sessionKey !== activeSessionKey
    ) {
        historyIndex--;
    }

    // NOTHING TO UNDO IN THIS SESSION
    if (historyIndex === -1) return;

    // GET THE MOST RECENT ACTION
    const lastAction = undoHistory.splice(historyIndex, 1)[0];

    // RESTORE THE ORIGINAL QUESTION DECK
    deck = lastAction.deckIds
        .map(id => allQuestions.find(q => q.id === id))
        .filter(q => q !== undefined);

    level = lastAction.level;
    randomMode = lastAction.randomMode;

    // RESTORE THE QUESTION POSITION
    idx = deck.findIndex(
        q => q.id === lastAction.questionId
    );

    // IF THE QUESTION NO LONGER EXISTS, STOP
    if (idx === -1) {
        saveProgress();
        show();
        return;
    }

    // REVERSE COMPLETION IF NECESSARY
    if (
        lastAction.action === "completed" &&
        !lastAction.wasExplored
    ) {
        explored.delete(lastAction.questionId);
    }

    // SAVE THE REVERSED PROGRESS AND UPDATED HISTORY
    current = null;

    saveProgress();

    // RETURN TO THE QUESTION THAT WAS UNDONE
    show();

    renderLevels();
}


// DISPLAY SAVED QUESTIONS IN THE POPUP
function renderSaved() {

    // UPDATE SAVED QUESTION COUNTS
    $("savedCount").textContent = saved.size;
    $("homeSavedCount").textContent = saved.size;

    let root = $("savedList");
    root.innerHTML = "";

    // GET ALL SAVED QUESTIONS
    let list = allQuestions.filter(
        q => saved.has(q.id)
    );

    // EMPTY STATE
    if (!list.length) {

        root.textContent =
            "No saved questions yet. Tap ♡ on a question to keep it here.";

        return;
    }

    // DISPLAY EACH SAVED QUESTION
    list.forEach(q => {

        let d = document.createElement("div");
        d.className = "saveditem";

        d.innerHTML = `
            <div class="saveditem-info">
                <small>LEVEL ${q.level} — ${escapeHTML(titleForLevel(q.level))}</small>
                <p>${escapeHTML(q.text)}</p>
            </div>

            <button class="remove-saved" title="Remove saved question">
                ♥
            </button>
        `;

        // REMOVE SAVED QUESTION
        d.querySelector(".remove-saved").onclick = () => {

            saved.delete(q.id);

            saveProgress();

            renderSaved();

            // UPDATE HEART ON CURRENT QUESTION IF NECESSARY
            if (current && current.id === q.id) {
                $("save").textContent = "♡";
            }
        };

        root.appendChild(d);
    });
}


// OPEN SAVED QUESTIONS POPUP
function openSavedModal() {

    renderSaved();

    $("savedModal").classList.remove("hidden");
}


// CLOSE SAVED QUESTIONS POPUP
function closeSavedModal() {

    $("savedModal").classList.add("hidden");
}


// SAVED QUESTIONS BUTTONS
$("homeSavedToggle").onclick = openSavedModal;
$("savedToggle").onclick = openSavedModal;


// CLOSE BUTTON
$("closeSavedModal").onclick = closeSavedModal;


// CLOSE WHEN CLICKING OUTSIDE THE POPUP
$("savedModal").querySelector(".saved-overlay").onclick =
    closeSavedModal;


// CLOSE POPUP WITH ESCAPE KEY
document.addEventListener("keydown", e => {

    if (e.key === "Escape") {
        closeSavedModal();
    }
});


// NEXT QUESTION
$("next").onclick = advance;


// UNDO QUESTION
$("undo").onclick = undo;


// PASS QUESTION
$("pass").onclick = () => {

    if (!current) return;

    // RECORD THE SKIPPED QUESTION
    recordUndo("skipped");

    idx++;

    // IN A REGULAR LEVEL, SKIP QUESTIONS ALREADY EXPLORED
    // RANDOMIZER QUESTIONS ARE ALREADY UNIQUE
    if (!randomMode) {

        while (
            idx < deck.length &&
            explored.has(deck[idx].id)
        ) {
            idx++;
        }
    }

    show();
};


// BACK TO LEVELS
$("back").onclick = () => {

    // END THE CURRENT SESSION
    endSession();

    closeSavedModal();

    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");

    renderLevels();
    renderSaved();
};


// HOME BUTTON
$("home").onclick = e => {

    e.preventDefault();

    // END THE CURRENT SESSION
    endSession();

    closeSavedModal();

    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");

    renderLevels();
    renderSaved();
};


// RESET ALL PROGRESS
$("reset").onclick = () => {

    if (confirm("Reset all explored-question progress and saved questions?")) {

        explored.clear();
        saved.clear();
        undoHistory = [];

        // END THE CURRENT SESSION
        inGame = false;
        current = null;
        activeSessionKey = null;

        // CLEAR LOCAL STORAGE DATA
        saveProgress();

        $("game").classList.add("hidden");
        $("intro").classList.remove("hidden");

        closeSavedModal();

        renderLevels();
        renderSaved();
    }
};


// SAVE / UNSAVE QUESTION
$("save").onclick = () => {

    if (!current) return;

    if (saved.has(current.id)) {

        saved.delete(current.id);

    } else {

        saved.add(current.id);
    }

    // SAVE CHANGES IMMEDIATELY
    saveProgress();

    show();
};


// LOAD EVERYTHING
loadQuestions();
