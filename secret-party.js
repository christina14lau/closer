const PARTY_SHEET_URL = "https://script.google.com/macros/s/AKfycbx2wUj3WMQv8BXJE0Fne_5S4kathR9X4x2rGSO0_5KlUu6tKWFJRaBWlnnYz0kpbqP6Gw/exec?sheet=GameQuestions";


// LOCAL STORAGE KEY
const PARTY_STORAGE_KEY = "closer_party_progress_v1";
const $ = id => document.getElementById(id);


// GLOBAL VARIABLES
let partyGames = {};
let allPartyQuestions = [];

let currentPartyQuestions = [];
let currentPartyQuestionIndex = 0;
let currentPartyGame = null;

let exploredParty = loadPartySet("explored");
let savedParty = loadPartySet("saved");

let partyUndoHistory = [];

let partySession = false;
let activePartySessionKey = null;


// LOCAL STORAGE
// LOAD SAVED PARTY DATA
function loadPartyData() {

    try {

        return JSON.parse(
            localStorage.getItem(PARTY_STORAGE_KEY) || "{}"
        );

    } catch (error) {

        console.error("Unable to load party progress:", error);

        return {};
    }
}


// LOAD SAVED SETS
function loadPartySet(key) {

    const data = loadPartyData();

    if (!Array.isArray(data[key])) {
        return new Set();
    }

    return new Set(
        data[key].map(id => String(id))
    );
}


// GET A UNIQUE QUESTION ID
function getPartyQuestionId(question, gameName) {

    return `${gameName}::${String(question.gameId)}`;
}


// SAVE PARTY PROGRESS
function savePartyProgress() {

    try {

        localStorage.setItem(
            PARTY_STORAGE_KEY,
            JSON.stringify({

                explored: [...exploredParty],

                saved: [...savedParty],

                undoHistory: partyUndoHistory,

                activeSession: partySession
                    ? {
                        sessionKey: activePartySessionKey,
                        game: currentPartyGame,
                        deckIds: currentPartyQuestions.map(q => String(q.gameId)),
                        index: currentPartyQuestionIndex
                    }
                    : null

            })
        );

    } catch (error) {

        console.error("Unable to save party progress:", error);
    }
}


// SESSION MANAGEMENT

// START A NEW PARTY SESSION
function startPartySession(gameName) {

    currentPartyGame = gameName;

    activePartySessionKey = `party-${gameName}`;

    partySession = true;

    savePartyProgress();
}


// END PARTY SESSION
function endPartySession() {

    partySession = false;

    activePartySessionKey = null;

    currentPartyGame = null;

    currentPartyQuestions = [];

    currentPartyQuestionIndex = 0;

    savePartyProgress();
}


// RESTORE PREVIOUS PARTY SESSION
function restorePartySession() {

    try {

        const data = loadPartyData();

        const previousSession = data.activeSession;

        if (
            !previousSession ||
            !previousSession.game ||
            !Array.isArray(previousSession.deckIds)
        ) {
            return false;
        }

        const gameName = previousSession.game;

        const gameQuestions = partyGames[gameName];

        if (!gameQuestions) {
            return false;
        }

        // RESTORE ORIGINAL QUESTION DECK
        currentPartyQuestions = previousSession.deckIds
            .map(id => gameQuestions.find(
                q => String(q.gameId) === String(id)
            ))
            .filter(q => q !== undefined);

        if (currentPartyQuestions.length === 0) {
            return false;
        }

        currentPartyGame = gameName;

        activePartySessionKey =
            previousSession.sessionKey || `party-${gameName}`;

        currentPartyQuestionIndex = Math.max(
            0,
            Math.min(
                Number(previousSession.index) || 0,
                currentPartyQuestions.length
            )
        );

        partySession = true;

        $("partyIntro").classList.add("hidden");

        $("partyGame").classList.remove("hidden");

        $("selectedGame").textContent =
            formatGameName(gameName);

        $("partyRound").textContent =
            `${currentPartyQuestions.length} QUESTIONS`;

        renderPartyQuestion();

        console.log("Previous party session restored.");

        return true;

    } catch (error) {

        console.error("Unable to restore party session:", error);

        return false;
    }
}


// GAME ICONS AND TITLES
// GET AN ICON FOR EACH GAME
function getGameIcon(gameName) {

    const icons = {
        "wyr": "🤔",
        "this_or_that": "⚖️",
        "who_more_likely": "👀",
        "truth": "💭",
        "dare": "🎲",
        "guess_my_answer": "🔮",
        "never_have_i_ever": "🥂",
        "finish_sentence": "✍️",
        "mini_challenge": "✨",
        "two_truths_lie": "🕵️"
    };

    return icons[gameName.toLowerCase()] || "♡";
}


// CONVERT GAME NAMES INTO DISPLAY TITLES
function formatGameName(gameName) {

    const gameTitles = {
        "wyr": "Would You Rather",
        "this_or_that": "This or That",
        "who_more_likely": "Who's More Likely To",
        "truth": "Truth",
        "dare": "Dare",
        "guess_my_answer": "Guess My Answer",
        "never_have_i_ever": "Never Have I Ever",
        "finish_sentence": "Finish the Sentence",
        "mini_challenge": "Mini Challenges",
        "two_truths_lie": "Two Truths and a Lie"
    };

    return gameTitles[gameName.toLowerCase()] || gameName;
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


// LOAD PARTY QUESTIONS
async function loadPartyGames() {

    try {

        const response = await fetch(PARTY_SHEET_URL);

        if (!response.ok) {
            throw new Error("Unable to connect to Google Sheets.");
        }

        const questions = await response.json();

        if (!Array.isArray(questions)) {
            throw new Error("Invalid party question data.");
        }

        // GROUP QUESTIONS BY GAME NAME
        const games = {};

        questions.forEach(question => {

            if (!question.game || !question.gameId || !question.text) {
                return;
            }

            const gameName = String(question.game)
                .trim()
                .toLowerCase();

            if (!games[gameName]) {
                games[gameName] = [];
            }

            games[gameName].push({

                ...question,

                gameId: String(question.gameId).trim(),

                text: String(question.text)

            });

        });

        partyGames = games;

        // GET ALL PARTY QUESTIONS
        allPartyQuestions = Object.values(partyGames).flat();

        // GET VALID QUESTION IDS
        const validIds = new Set(
            allPartyQuestions.map(q =>
                getPartyQuestionId(
                    q,
                    String(q.game).trim().toLowerCase()
                )
            )
        );

        // CLEAN UP EXPLORED QUESTIONS
        exploredParty = new Set(
            [...exploredParty].filter(id => validIds.has(id))
        );

        // CLEAN UP SAVED QUESTIONS
        savedParty = new Set(
            [...savedParty].filter(id => validIds.has(id))
        );

        // RESTORE AND CLEAN UP UNDO HISTORY
        const savedData = loadPartyData();

        partyUndoHistory = Array.isArray(savedData.undoHistory)
            ? savedData.undoHistory.filter(
                action => validIds.has(action.questionId)
            )
            : [];

        // RENDER GAME CARDS
        renderPartyGames(partyGames);

        // CREATE PARTY CONTROLS
        createPartyControls();

        // RESTORE PREVIOUS SESSION
        const restored = restorePartySession();

        // SAVE CLEANED DATA
        savePartyProgress();

        // RENDER SAVED QUESTIONS
        renderPartySaved();

        console.log("Party questions loaded:", allPartyQuestions.length);

        console.log("Explored party questions:", exploredParty.size);

        console.log("Saved party questions:", savedParty.size);

        console.log("Party undo history:", partyUndoHistory.length);

        if (!restored) {

            $("partyGame").classList.add("hidden");

            $("partyIntro").classList.remove("hidden");
        }

    } catch (error) {

        console.error("Unable to load party games:", error);

        $("partyGames").innerHTML = `
            <p class="party-error">
                We couldn't load the party games.
                Please check your Google Sheets connection and try again.
            </p>
        `;
    }
}


// DISPLAY PARTY GAME CARDS
function renderPartyGames(games) {

    const root = $("partyGames");

    root.innerHTML = "";

    const gameNames = Object.keys(games);

    if (gameNames.length === 0) {

        root.innerHTML = `
            <p class="party-empty">
                No party games found yet.
                Check your GameQuestions spreadsheet tab.
            </p>
        `;

        $("partyQuestionCount").textContent = "0 questions";

        return;
    }

    let totalQuestions = 0;

    gameNames.forEach(gameName => {

        const questions = games[gameName];

        totalQuestions += questions.length;

        const done = questions.filter(q =>
            exploredParty.has(getPartyQuestionId(q, gameName))
        ).length;

        const percent = questions.length
            ? (done / questions.length) * 100
            : 0;

        const card = document.createElement("button");

        card.className = "party-card";

        card.type = "button";

        card.onclick = () => openPartyGame(gameName);

        card.innerHTML = `

            <span class="party-card-icon">
                ${getGameIcon(gameName)}
            </span>

            <div class="party-card-content">

                <div class="party-card-title">
                    ${escapeHTML(formatGameName(gameName))}
                </div>

                <div class="party-card-count">
                    ${questions.length} questions
                </div>

                <div class="party-card-progress">
                    <div style="width:${percent}%"></div>
                </div>

                <div class="party-card-action">
                    ${done} / ${questions.length} explored
                </div>

            </div>
        `;

        root.appendChild(card);
    });

    $("partyQuestionCount").textContent =
        `${totalQuestions} questions · ${gameNames.length} games`;

}


// OPEN A SELECTED GAME
function openPartyGame(gameName) {

    currentPartyQuestions = partyGames[gameName];

    if (
        !currentPartyQuestions ||
        currentPartyQuestions.length === 0
    ) {
        return;
    }

    startPartySession(gameName);

    // RESUME FROM FIRST UNEXPLORED QUESTION
    currentPartyQuestionIndex = currentPartyQuestions.findIndex(
        q => !exploredParty.has(
            getPartyQuestionId(q, gameName)
        )
    );

    // IF EVERYTHING HAS BEEN EXPLORED
    if (currentPartyQuestionIndex === -1) {
        currentPartyQuestionIndex = currentPartyQuestions.length;
    }

    $("partyIntro").classList.add("hidden");

    $("partyGame").classList.remove("hidden");

    $("selectedGame").textContent =
        formatGameName(gameName);

    $("partyRound").textContent =
        `${currentPartyQuestions.length} QUESTIONS`;

    renderPartyQuestion();
}


// PARTY QUESTION CONTROLS
// CREATE PARTY CONTROLS
function createPartyControls() {

    // SAVE QUESTION BUTTON
    if (!$("partySave")) {

        const saveButton = document.createElement("button");

        saveButton.id = "partySave";
        saveButton.className = "party-save";
        saveButton.type = "button";
        saveButton.textContent = "♡";
        saveButton.title = "Save question";

        $("partyQuestionText").insertAdjacentElement(
            "afterend",
            saveButton
        );
    }

    $("partySave").onclick = togglePartySave;


    // PASS BUTTON
    if (!$("partyPass")) {

        const passButton = document.createElement("button");

        passButton.id = "partyPass";
        passButton.className = "party-pass";
        passButton.type = "button";
        passButton.textContent = "Pass →";

        $("partyNext").insertAdjacentElement(
            "beforebegin",
            passButton
        );
    }

    $("partyPass").onclick = passPartyQuestion;


    // UNDO BUTTON
    if (!$("partyUndo")) {

        const undoButton = document.createElement("button");

        undoButton.id = "partyUndo";
        undoButton.className = "party-undo";
        undoButton.type = "button";
        undoButton.textContent = "↶ Undo";

        $("partyNext").insertAdjacentElement(
            "beforebegin",
            undoButton
        );
    }

    $("partyUndo").onclick = undoPartyQuestion;


    // SAVED QUESTIONS BUTTON
    if ($("partySavedToggle")) {
        $("partySavedToggle").onclick = openPartySaved;
    }


    // RESET BUTTON
    if ($("partyReset")) {
        $("partyReset").onclick = resetPartyProgress;
    }


    // SAVED QUESTIONS MODAL
    createPartySavedModal();

    updatePartyUndoButton();
}


// DISPLAY CURRENT QUESTION
function renderPartyQuestion() {

    const question = currentPartyQuestions[
        currentPartyQuestionIndex
    ];

    // CHECK IF GAME IS COMPLETE
    if (!question) {

        $("partyQuestionNumber").textContent =
            "GAME COMPLETE";

        $("partyQuestionText").textContent =
            "You've reached the end of this game! ♡";

        $("partyOptions").innerHTML = "";

        $("partyFollowUp").classList.add("hidden");

        $("partySave").classList.add("hidden");

        $("partyPass").classList.add("hidden");

        $("partyUndo").classList.remove("hidden");

        $("partyNext").textContent = "Back to Games ↗";

        $("partyRound").textContent =
            "ALL QUESTIONS COMPLETED";

        updatePartyUndoButton();

        savePartyProgress();

        return;
    }

    // QUESTION NUMBER
    $("partyQuestionNumber").textContent =
        `QUESTION ${currentPartyQuestionIndex + 1} OF ${currentPartyQuestions.length}`;

    // QUESTION TEXT
    $("partyQuestionText").textContent = question.text;

    // CLEAR OLD OPTIONS
    const options = $("partyOptions");

    options.innerHTML = "";

    $("partyFollowUp").classList.add("hidden");

    $("partyFollowUp").textContent = "";


    // DISPLAY TWO CHOICES IF AVAILABLE
    if (question.optionA && question.optionB) {

        [question.optionA, question.optionB].forEach(option => {

            const button = document.createElement("button");

            button.className = "party-option";

            button.textContent = option;

            button.onclick = () => {

                options.querySelectorAll(".party-option").forEach(item => {
                    item.classList.remove("selected");
                });

                button.classList.add("selected");

                if (question.followUp) {

                    $("partyFollowUp").textContent =
                        question.followUp;

                    $("partyFollowUp").classList.remove("hidden");
                }
            };

            options.appendChild(button);
        });
    }


    // UPDATE SAVE BUTTON
    $("partySave").classList.remove("hidden");

    const questionId = getPartyQuestionId(
        question,
        currentPartyGame
    );

    $("partySave").textContent =
        savedParty.has(questionId) ? "♥" : "♡";

    $("partySave").title =
        savedParty.has(questionId)
            ? "Remove saved question"
            : "Save question";


    // SHOW PASS BUTTON
    $("partyPass").classList.remove("hidden");

    // UPDATE NEXT BUTTON
    $("partyNext").textContent =
        currentPartyQuestionIndex === currentPartyQuestions.length - 1
            ? "Finish Game ♡"
            : "Next Question →";

    updatePartyUndoButton();

    // SAVE CURRENT SESSION POSITION
    savePartyProgress();
}


// SAVE / UNSAVE QUESTIONS
function togglePartySave() {

    const question = currentPartyQuestions[
        currentPartyQuestionIndex
    ];

    if (!question) return;

    const questionId = getPartyQuestionId(
        question,
        currentPartyGame
    );

    if (savedParty.has(questionId)) {

        savedParty.delete(questionId);

    } else {

        savedParty.add(questionId);
    }

    savePartyProgress();

    renderPartyQuestion();

    renderPartySaved();
}



// UNDO HISTORY
// RECORD QUESTION ACTIONS FOR UNDO
function recordPartyUndo(action) {

    const question = currentPartyQuestions[
        currentPartyQuestionIndex
    ];

    if (!question) return;

    partyUndoHistory.push({

        questionId: getPartyQuestionId(
            question,
            currentPartyGame
        ),

        gameName: currentPartyGame,

        action: action,

        wasExplored: exploredParty.has(
            getPartyQuestionId(question, currentPartyGame)
        ),

        deckIds: currentPartyQuestions.map(
            q => String(q.gameId)
        ),

        index: currentPartyQuestionIndex,

        sessionKey: activePartySessionKey

    });

    // LIMIT HISTORY TO 100 ACTIONS
    if (partyUndoHistory.length > 100) {

        partyUndoHistory.shift();
    }

    savePartyProgress();
}


// UPDATE UNDO BUTTON
function updatePartyUndoButton() {

    const button = $("partyUndo");

    if (!button) return;

    const canUndo = partyUndoHistory.some(
        action => action.sessionKey === activePartySessionKey
    );

    button.disabled = !canUndo;
}


// UNDO THE MOST RECENT ACTION
function undoPartyQuestion() {

    if (!activePartySessionKey) return;

    // FIND MOST RECENT ACTION FOR THIS SESSION
    let historyIndex = partyUndoHistory.length - 1;

    while (
        historyIndex >= 0 &&
        partyUndoHistory[historyIndex].sessionKey !== activePartySessionKey
    ) {

        historyIndex--;
    }

    if (historyIndex === -1) return;

    // REMOVE ACTION FROM HISTORY
    const lastAction = partyUndoHistory.splice(
        historyIndex,
        1
    )[0];

    const gameName = lastAction.gameName;

    const gameQuestions = partyGames[gameName];

    if (!gameQuestions) return;

    // RESTORE ORIGINAL DECK
    currentPartyQuestions = lastAction.deckIds
        .map(id => gameQuestions.find(
            q => String(q.gameId) === String(id)
        ))
        .filter(q => q !== undefined);

    currentPartyGame = gameName;

    // RESTORE QUESTION POSITION
    currentPartyQuestionIndex = currentPartyQuestions.findIndex(
        q => getPartyQuestionId(q, gameName) === lastAction.questionId
    );

    if (currentPartyQuestionIndex === -1) {

        savePartyProgress();

        return;
    }

    // REVERSE COMPLETION IF NECESSARY
    if (
        lastAction.action === "completed" &&
        !lastAction.wasExplored
    ) {

        exploredParty.delete(lastAction.questionId);
    }

    // KEEP SESSION ACTIVE
    partySession = true;

    activePartySessionKey = lastAction.sessionKey;

    // RETURN TO GAME SCREEN
    $("partyIntro").classList.add("hidden");

    $("partyGame").classList.remove("hidden");

    $("selectedGame").textContent =
        formatGameName(currentPartyGame);

    // SAVE AND RENDER
    savePartyProgress();

    renderPartyQuestion();

    renderPartyGames(partyGames);

    renderPartySaved();
}


// PASS QUESTION
function passPartyQuestion() {

    if (
        !partySession ||
        currentPartyQuestionIndex >= currentPartyQuestions.length
    ) {
        return;
    }

    // RECORD SKIP FOR UNDO
    recordPartyUndo("skipped");

    // MOVE TO NEXT QUESTION WITHOUT MARKING EXPLORED
    currentPartyQuestionIndex++;

    // SKIP QUESTIONS ALREADY EXPLORED
    while (
        currentPartyQuestionIndex < currentPartyQuestions.length &&
        exploredParty.has(
            getPartyQuestionId(
                currentPartyQuestions[currentPartyQuestionIndex],
                currentPartyGame
            )
        )
    ) {

        currentPartyQuestionIndex++;
    }

    savePartyProgress();

    renderPartyQuestion();
}


// NEXT QUESTION / COMPLETE QUESTION
function advancePartyQuestion() {

    // IF GAME IS COMPLETE, RETURN TO GAME SELECTION
    if (
        currentPartyQuestionIndex >= currentPartyQuestions.length
    ) {

        endPartySession();

        $("partyGame").classList.add("hidden");

        $("partyIntro").classList.remove("hidden");

        renderPartyGames(partyGames);

        renderPartySaved();

        return;
    }

    const question = currentPartyQuestions[
        currentPartyQuestionIndex
    ];

    // RECORD ACTION FOR UNDO
    recordPartyUndo("completed");

    // MARK QUESTION AS EXPLORED
    exploredParty.add(
        getPartyQuestionId(question, currentPartyGame)
    );

    // MOVE TO NEXT QUESTION
    currentPartyQuestionIndex++;

    // SKIP ALREADY EXPLORED QUESTIONS
    while (
        currentPartyQuestionIndex < currentPartyQuestions.length &&
        exploredParty.has(
            getPartyQuestionId(
                currentPartyQuestions[currentPartyQuestionIndex],
                currentPartyGame
            )
        )
    ) {

        currentPartyQuestionIndex++;
    }

    // SAVE PROGRESS
    savePartyProgress();

    // UPDATE DISPLAY
    renderPartyQuestion();

    renderPartyGames(partyGames);

    renderPartySaved();
}


// SAVED QUESTIONS MODAL
// CREATE OR CONNECT SAVED QUESTIONS MODAL
function createPartySavedModal() {

    let modal = $("partySavedModal");

    // CREATE MODAL IF IT DOES NOT EXIST IN HTML
    if (!modal) {

        modal = document.createElement("div");

        modal.id = "partySavedModal";
        modal.className = "party-saved-modal hidden";

        modal.innerHTML = `

            <div class="party-saved-overlay"></div>

            <div class="party-saved-content">

                <div class="party-saved-header">

                    <div>
                        <h2>Saved Questions ♡</h2>
                        <p>Your favorite party questions.</p>
                    </div>

                    <button
                        type="button"
                        id="partySavedClose"
                        aria-label="Close saved questions"
                    >
                        ×
                    </button>

                </div>

                <div id="partySavedList" class="party-saved-list"></div>

            </div>

        `;

        document.body.appendChild(modal);
    }

    // CLOSE BUTTON
    if ($("partySavedClose")) {
        $("partySavedClose").onclick = closePartySaved;
    }

    // CLOSE WHEN CLICKING OVERLAY
    const overlay = modal.querySelector(".party-saved-overlay");

    if (overlay) {
        overlay.onclick = closePartySaved;
    }

    // CLOSE WITH ESCAPE
    if (!document.body.dataset.partyEscapeListener) {

        document.addEventListener("keydown", e => {

            if (
                e.key === "Escape" &&
                $("partySavedModal") &&
                !$("partySavedModal").classList.contains("hidden")
            ) {
                closePartySaved();
            }

        });

        document.body.dataset.partyEscapeListener = "true";
    }
}


// DISPLAY SAVED QUESTIONS
function renderPartySaved() {

    const root = $("partySavedList");

    if (!root) return;

    root.innerHTML = "";

    const list = allPartyQuestions.filter(q => {

        const gameName = String(q.game).trim().toLowerCase();

        return savedParty.has(
            getPartyQuestionId(q, gameName)
        );

    });

    // UPDATE SAVED COUNT
    if ($("partySavedCount")) {
        $("partySavedCount").textContent = savedParty.size;
    }

    // EMPTY STATE
    if (list.length === 0) {

        root.innerHTML = `
            <p class="party-empty">
                No saved questions yet.
                Tap ♡ on a question to keep it here.
            </p>
        `;

        return;
    }

    // DISPLAY SAVED QUESTIONS
    list.forEach(q => {

        const gameName = String(q.game).trim().toLowerCase();

        const item = document.createElement("div");

        item.className = "party-saved-item";

        item.innerHTML = `

            <div class="party-saved-info">

                <small>
                    ${escapeHTML(formatGameName(gameName))}
                </small>

                <p>${escapeHTML(q.text)}</p>

            </div>

            <button
                type="button"
                class="party-remove-saved"
                title="Remove saved question"
            >
                ♥
            </button>

        `;

        item.querySelector(".party-remove-saved").onclick = () => {

            savedParty.delete(
                getPartyQuestionId(q, gameName)
            );

            savePartyProgress();

            renderPartySaved();

            // UPDATE CURRENT HEART IF NECESSARY
            const currentQuestion = currentPartyQuestions[
                currentPartyQuestionIndex
            ];

            if (
                currentQuestion &&
                String(currentQuestion.gameId) === String(q.gameId) &&
                currentPartyGame === gameName
            ) {

                $("partySave").textContent = "♡";

                $("partySave").title = "Save question";
            }

        };

        root.appendChild(item);

    });

}


// OPEN SAVED QUESTIONS
function openPartySaved() {

    renderPartySaved();

    $("partySavedModal").classList.remove("hidden");
}


// CLOSE SAVED QUESTIONS
function closePartySaved() {

    if ($("partySavedModal")) {

        $("partySavedModal").classList.add("hidden");
    }
}


// RESET PARTY PROGRESS
function resetPartyProgress() {

    if (!confirm(
        "Reset all Secret Party progress, saved questions, and undo history?"
    )) {
        return;
    }

    // CLEAR PARTY DATA
    exploredParty.clear();

    savedParty.clear();

    partyUndoHistory = [];

    // END CURRENT SESSION
    partySession = false;

    activePartySessionKey = null;

    currentPartyGame = null;

    currentPartyQuestions = [];

    currentPartyQuestionIndex = 0;

    // SAVE EMPTY DATA
    savePartyProgress();

    // RETURN TO GAME SELECTION
    $("partyGame").classList.add("hidden");

    $("partyIntro").classList.remove("hidden");

    // CLOSE MODAL
    closePartySaved();

    // REFRESH DISPLAY
    renderPartyGames(partyGames);

    renderPartySaved();
}


// NAVIGATION BUTTONS
// RETURN TO GAME SELECTION
$("partyBack").onclick = () => {

    endPartySession();

    closePartySaved();

    $("partyGame").classList.add("hidden");

    $("partyIntro").classList.remove("hidden");

    renderPartyGames(partyGames);

    renderPartySaved();

};


// NEXT QUESTION
$("partyNext").onclick = advancePartyQuestion;


// LOAD PAGE
loadPartyGames();
