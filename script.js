
const TITLES = [
    "First Impressions",
    "Values & Worldviews",
    "Emotional Intimacy",
    "Love & Relationships",
    "Personal History & Healing",
    "The Future & Deep Connection",
    "Situations & Character",
    "The Unspoken",
    "Adult Intimacy"
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
    "Explore physical attraction, sexual compatibility, desires, boundaries, and adult intimacy. 18+ only."
];

const SHEET_URL = "https://script.google.com/macros/s/AKfycbx2wUj3WMQv8BXJE0Fne_5S4kathR9X4x2rGSO0_5KlUu6tKWFJRaBWlnnYz0kpbqP6Gw/exec";

const $ = id => document.getElementById(id);

let allQuestions = [];
let level = 1;
let deck = [];
let idx = 0;
let explored = new Set();
let saved = new Set();
let current = null;


// GET QUESTIONS FROM GOOGLE SHEETS
async function loadQuestions() {
    $("levels").textContent = "Loading questions...";

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

        console.log("Questions loaded:", allQuestions.length);

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
        : TITLES[n - 1];
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
                    <span>Open level →</span>
                </div>
            </span>
        `;

        el.onclick = () => start(n);
        root.appendChild(el);
    });

    $("overallCount").textContent =
        `${explored.size} / ${allQuestions.length} explored`;

    let percent = allQuestions.length
        ? Math.round(explored.size / allQuestions.length * 100)
        : 0;

    $("percent").textContent = percent + "%";
    $("overallFill").style.width = percent + "%";

    // UPDATE HOMEPAGE QUESTION COUNT
    const footnote = document.getElementById("questionCount");

    if (footnote) {
        footnote.textContent =
            `${allQuestions.length} questions · ${TITLES.length} levels`;
    }
}


// START A LEVEL
function start(n) {
    level = n;
    deck = qs(n);
    idx = 0;
    current = null;

    $("intro").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("savedPanel").classList.add("hidden");

    show();
}


// DISPLAY CURRENT QUESTION
function show() {
    if (idx >= deck.length) {
        current = null;

        $("question").textContent =
            "You've explored every question in this level.";

        $("hint").textContent =
            "Return to all levels to choose another deck or revisit saved questions.";

        $("number").textContent = "♡";
        $("pill").textContent = `LEVEL ${level} COMPLETE`;
        $("round").textContent = "LEVEL COMPLETE";
        $("progress").style.width = "100%";

        $("levelProgress").textContent =
            `${deck.filter(q => explored.has(q.id)).length} explored in this level`;

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

    $("number").textContent = String(idx + 1).padStart(2, "0");

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

    $("progress").style.width =
        idx / deck.length * 100 + "%";

    $("levelProgress").textContent =
        `${deck.filter(q => explored.has(q.id)).length} explored in this level`;

    $("save").classList.remove("hidden");

    $("save").textContent =
        saved.has(current.id) ? "♥" : "♡";

    $("next").textContent =
        explored.has(current.id) ? "Next question →" : "Mark explored →";

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
    if (idx >= deck.length) {
        $("game").classList.add("hidden");
        $("intro").classList.remove("hidden");
        renderLevels();
        return;
    }

    if (current) {
        explored.add(current.id);
    }

    idx++;
    show();
    renderLevels();
}


// DISPLAY SAVED QUESTIONS
function renderSaved() {
    $("savedCount").textContent = saved.size;

    let root = $("savedList");
    root.innerHTML = "";

    let list = allQuestions.filter(q => saved.has(q.id));

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
$("next").onclick = advance;

$("pass").onclick = () => {
    idx++;
    show();
};

$("back").onclick = () => {
    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");
    renderLevels();
};

$("home").onclick = e => {
    e.preventDefault();

    $("game").classList.add("hidden");
    $("intro").classList.remove("hidden");

    renderLevels();
};

$("reset").onclick = () => {
    if (confirm("Reset all explored-question progress and saved questions?")) {
        explored.clear();
        saved.clear();

        $("game").classList.add("hidden");
        $("intro").classList.remove("hidden");

        renderLevels();
        renderSaved();
    }
};

$("save").onclick = () => {
    if (!current) return;

    if (saved.has(current.id)) {
        saved.delete(current.id);
    } else {
        saved.add(current.id);
    }

    show();
};

$("savedToggle").onclick = () => {
    $("savedPanel").classList.toggle("hidden");
};


// LOAD EVERYTHING
loadQuestions();
