
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


// GLOBAL VARIABLES
let allQuestions = [];
let level = 1;
let deck = [];
let idx = 0;
let explored = loadStoredSet("explored");
let saved = loadStoredSet("saved");
let current = null;


// SAVE PROGRESS TO LOCAL STORAGE
function saveProgress() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                explored: [...explored],
                saved: [...saved]
            })
        );

    } catch (error) {
        console.error("Unable to save progress:", error);
    }
}


// GET QUESTIONS FROM GOOGLE SHEETS
async function loadQuestions() {
    //$("levels").textContent = "Loading questions...";

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

        saveProgress();

        console.log("Questions loaded:", allQuestions.length);
        console.log("Explored questions:", explored.size);
        console.log("Saved questions:", saved.size);

        renderLevels();
        renderSaved();

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


// DISPLAY LEVELS
function renderLevels() {
    let root = $("levels");
    root.innerHTML = "";

    TITLES.forEach((title, i) => {
        let n = i + 1;
        let list = qs(n);
        let done = list.filter(q => explored.has(q.id)).length;

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

        el.onclick = () => start(n);

        root.appendChild(el);
    });

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
    level = n;
    deck = qs(n);

    // RESUME FROM FIRST UNEXPLORED QUESTION
    idx = deck.findIndex(q => !explored.has(q.id));

    // IF EVERYTHING IS EXPLORED, SHOW COMPLETION
    if (idx === -1) {
        idx = deck.length;
    }

    current = null;

    $("intro").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("savedPanel").classList.add("hidden");

    show();
}


// DISPLAY CURRENT QUESTION
function show() {

    // CHECK IF LEVEL IS COMPLETE
    if (idx >= deck.length) {
        current = null;

        let completed = deck.filter(
            q => explored.has(q.id)
        ).length;

        $("question").textContent =
            completed === deck.length
                ? "You've explored every question in this level."
                : "You've reached the end of this level.";

        $("hint").textContent =
            "Return to all levels to choose another deck or revisit saved questions.";

        $("number").textContent = "♡";

        $("pill").textContent =
            `LEVEL ${level} COMPLETE`;

        $("round").textContent = "LEVEL COMPLETE";

        $("progress").style.width =
            deck.length
                ? completed / deck.length * 100 + "%"
                : "0%";

        $("levelProgress").textContent =
            `${completed} / ${deck.length} explored in this level`;

        $("next").textContent = "Back to levels ↗";

        $("save").classList.add("hidden");
        $("interpretation").classList.add("hidden");

        return;
    }

    current = deck[idx];

    $("question").textContent = current.text;

    $("hint").textContent = current.hint ||
        (current.section
            ? `Section: ${current.section}. Take turns answering. You can always pass.`
            : "Take turns answering. You can always pass.");

    $("number").textContent =
        String(idx + 1).padStart(2, "0");

    let typeLabel = current.type !== "standard"
        ? ` · ${current.type.toUpperCase()}`
        : "";

    let adultLabel = level === 9 ? " · 18+" : "";

    $("round").textContent =
        `LEVEL ${level}${typeLabel}${adultLabel} · QUESTION ${String(idx + 1).padStart(2, "0")}`;

    let sectionLabel = current.section
        ? ` · ${current.section}`
        : "";

    $("pill").textContent =
        `LEVEL ${level} — ${titleForLevel(level).toUpperCase()}${sectionLabel}${adultLabel}`;

    // PROGRESS BASED ON ACTUALLY EXPLORED QUESTIONS
    let completed = deck.filter(
        q => explored.has(q.id)
    ).length;

    $("progress").style.width =
        deck.length
            ? completed / deck.length * 100 + "%"
            : "0%";

    $("levelProgress").textContent =
        `${completed} / ${deck.length} explored in this level`;

    $("save").classList.remove("hidden");

    $("save").textContent =
        saved.has(current.id) ? "♥" : "♡";

    $("next").textContent =
        explored.has(current.id)
            ? "Next question →"
            : "Mark explored →";

    if (current.interpretation) {
        $("interpretation").textContent = current.interpretation;
        $("interpretation").classList.remove("hidden");
    } else {
        $("interpretation").classList.add("hidden");
    }

    renderSaved();
}


// MOVE TO NEXT QUESTION
function advance() {
    if (current) {
        explored.add(current.id);
        saveProgress();
    }

    idx++;

    // Skip questions that have already been answered
    while (idx < deck.length && explored.has(deck[idx].id)) {
        idx++;
    }

    show();
    renderLevels();
}


// DISPLAY SAVED QUESTIONS
function renderSaved() {
    $("savedCount").textContent = saved.size;

    let root = $("savedList");
    root.innerHTML = "";

    let list = allQuestions.filter(
        q => saved.has(q.id)
    );

    if (!list.length) {
        root.textContent =
            "No saved questions yet. Tap ♡ on a question to keep it here.";
        return;
    }

    list.forEach(q => {
        let d = document.createElement("div");
        d.className = "saveditem";

        d.textContent =
            `Level ${q.level}: ${q.text}`;

        root.appendChild(d);
    });
}


// BUTTON EVENTS

// NEXT QUESTION
$("next").onclick = advance;


// PASS QUESTION
$("pass").onclick = () => {
    idx++;
    show();
};


// BACK TO LEVELS
$("back").onclick = () => {
    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");

    renderLevels();
};


// HOME BUTTON
$("home").onclick = e => {
    e.preventDefault();

    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");

    renderLevels();
};


// RESET ALL PROGRESS
$("reset").onclick = () => {

    if (confirm("Reset all explored-question progress and saved questions?")) {

        explored.clear();
        saved.clear();

        // CLEAR LOCAL STORAGE DATA
        saveProgress();

        $("game").classList.add("hidden");
        $("intro").classList.remove("hidden");

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


// TOGGLE SAVED QUESTIONS PANEL
$("savedToggle").onclick = () => {
    $("savedPanel").classList.toggle("hidden");
};


// LOAD EVERYTHING
loadQuestions();
