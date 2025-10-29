// This file initializes the application, sets up event listeners, and manages the overall flow of the app.

const samplePath = "./data/samples.json";

const noteIndexMap = {
    // diatonic index relative to bottom staff line (E4 = 0)
    C4: -2,
    D4: -1,
    E4: 0,
    F4: 1,
    G4: 2,
    A4: 3,
    B4: 4,
    C5: 5,
    D5: 6,
    E5: 7,
    F5: 8,
    G5: 9,
};

const durationMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5 };

let samples = [];
let audioCtx = null;
let masterGain = null; // master gain node for volume control
let playTimer = null;
let stopRequested = false;
let activeSources = []; // new: track active audio nodes to stop them cleanly

const sampleSelect = document.getElementById("sampleSelect");
const titleEl = document.getElementById("title");
const exerciseEl = document.getElementById("exercise");
const canvas = document.getElementById("staffCanvas");
const ctx = canvas.getContext("2d");
const tempoInput = document.getElementById("tempo");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
// new: pause input (seconds)
const pauseInput = document.getElementById("pauseSec");
// new: instrument selector
const instrumentSelect = document.getElementById("instrumentSelect");
// new: MIDI status display
const midiStatusEl = document.getElementById("midiStatus");
// new: settings controls
const volumeSlider = document.getElementById("volumeSlider");
const midiCapInput = document.getElementById("midiCap");
const midiCurveInput = document.getElementById("midiCurve");
const midiAttackMsInput = document.getElementById("midiAttackMs");
const midiReleaseMsInput = document.getElementById("midiReleaseMs");
const resetAudioSettingsBtn = document.getElementById("resetAudioSettings");

// defaults and storage
const defaultAudioSettings = {
    volume: 0.8,
    midiGainCap: 0.5,
    midiCurve: 1.5,
    midiAttackSec: 0.005,
    midiReleaseSec: 0.05,
};

function loadAudioSettings() {
    try {
        const raw = localStorage.getItem("audioSettings");
        if (!raw) return { ...defaultAudioSettings };
        const parsed = JSON.parse(raw);
        return { ...defaultAudioSettings, ...parsed };
    } catch (_) {
        return { ...defaultAudioSettings };
    }
}

function saveAudioSettings(settings) {
    try {
        localStorage.setItem("audioSettings", JSON.stringify(settings));
    } catch (_) {}
}

let audioSettings = loadAudioSettings();

// --- begin: keyboard + test mode additions ---
const keyboardEl = document.getElementById("keyboard");
const startTestBtn = document.getElementById("startTestBtn");
const stopTestBtn = document.getElementById("stopTestBtn");
const testStatus = document.getElementById("testStatus");
const scoreDisplay = document.getElementById("scoreDisplay");

let testActive = false;
let targetNote = null;
let score = 0;
let attempts = 0;
let currentTestIndex = 0; // new: index into current sample notes for sequential testing
let inputLocked = false; // <-- prevent clicks during pause/wait
let currentInstrument = "piano"; // new: hold current instrument waveform
let midiActiveNotes = new Map(); // new: Map to track active MIDI notes for proper note-off handling

// new: store loaded audio samples
const loadedSamples = { piano: {} };

// notes for keyboard (one octave + C5)
const keyboardNotes = [
    "C3",
    "C#3",
    "D3",
    "D#3",
    "E3",
    "F3",
    "F#3",
    "G3",
    "G#3",
    "A3",
    "A#3",
    "B3",
    "C4",
    "C#4",
    "D4",
    "D#4",
    "E4",
    "F4",
    "F#4",
    "G4",
    "G#4",
    "A4",
    "A#4",
    "B4",
    "C5",
    "C#5",
    "D5",
    "D#5",
    "E5",
    "F5",
    "F#5",
    "G5",
    "G#5",
    "A5",
    "A#5",
    "B5",
    "C6",
];
const blackSet = new Set([
    "C#3",
    "D#3",
    "F#3",
    "G#3",
    "A#3",
    "C#4",
    "D#4",
    "F#4",
    "G#4",
    "A#4",
    "C#5",
    "D#5",
    "F#5",
    "G#5",
    "A#5",
]);

// new: map computer keys to piano notes
const keyToNoteMap = {
    z: "C3",
    x: "D3",
    c: "E3",
    v: "F3",
    b: "G3",
    n: "A3",
    m: "B3",
    a: "C4",
    w: "C#4",
    s: "D4",
    e: "D#4",
    d: "E4",
    f: "F4",
    t: "F#4",
    g: "G4",
    y: "G#4",
    h: "A4",
    u: "A#4",
    j: "B4",
    k: "C5",
    o: "C#5",
    l: "D5",
    p: "D#5",
    ";": "E5",
    "'": "F5",
    "[": "F#5",
    "]": "G5",
    "\\": "G#5",
    ",": "A5",
    ".": "A#5",
    "/": "B5",
    " ": "C6", // Spacebar for C6
};

function renderKeyboard() {
    if (!keyboardEl) return;
    keyboardEl.innerHTML = "";

    // responsive sizes
    const small = window.innerWidth < 500;
    const keyWidth = small ? 30 : 40;
    const keyHeight = small ? 90 : 120;
    const blackWidth = small ? 20 : 26;
    const blackHeight = small ? 60 : 78;
    const whiteKeys = keyboardNotes.filter((n) => !blackSet.has(n)).length;

    // set container width to fit white keys
    keyboardEl.style.width = whiteKeys * keyWidth + "px";
    keyboardEl.style.height = keyHeight + "px";
    keyboardEl.style.position = "relative";

    let whiteIndex = 0;
    keyboardNotes.forEach((n) => {
        const isBlack = blackSet.has(n);
        const key = document.createElement("div");
        key.className = "key " + (isBlack ? "black" : "white");
        key.setAttribute("data-note", n);
        key.setAttribute("role", "button");
        key.style.position = "absolute";
        key.style.boxSizing = "border-box";
        key.style.cursor = "pointer";

        if (isBlack) {
            const left =
                (whiteIndex - 1) * keyWidth + (keyWidth - blackWidth / 2);
            key.style.left = left + "px";
            key.style.width = blackWidth + "px";
            key.style.height = blackHeight + "px";
            key.style.zIndex = 3;
        } else {
            const left = whiteIndex * keyWidth;
            key.style.left = left + "px";
            key.style.width = keyWidth + "px";
            key.style.height = keyHeight + "px";
            key.style.zIndex = 1;
            whiteIndex += 1;
        }

        key.addEventListener("click", () => {
            // add active class for visual feedback on click
            key.classList.add("active");
            handleKeyClick(n, key);
            setTimeout(() => key.classList.remove("active"), 200);
        });
        keyboardEl.appendChild(key);
    });
}

// new: added velocity parameter, default to 100 for non-MIDI input
function handleKeyClick(noteName, keyEl, velocity = 100) {
    if (inputLocked && testActive) return; // ignore clicks while locked in test mode

    const audioCtx = getAudioContext();
    const now = audioCtx.currentTime;
    
    // Scale MIDI velocity with adjustable curve and cap
    let gainValue;
    if (velocity !== 100) {
        const normalized = velocity / 127;
        const curve = audioSettings.midiCurve;
        const cap = audioSettings.midiGainCap;
        gainValue = Math.min(cap, Math.pow(normalized, curve) * cap);
    } else {
        // Mouse/keyboard click: use full gain for compatibility
        gainValue = 1.0;
    }

    // Create a gain node for this specific note to control its volume and stop it later
    const noteGain = audioCtx.createGain();
    noteGain.connect(getMasterOutput());
    // Attack ramp to prevent clicks on MIDI notes
    if (velocity !== 100) {
        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(
            gainValue,
            now + Math.max(0.001, audioSettings.midiAttackSec)
        );
    } else {
        noteGain.gain.setValueAtTime(gainValue, now);
    }

    // play sound: check if sample or synth
    if (
        // Use piano samples if selected and loaded
        currentInstrument === "piano" &&
        loadedSamples.piano[normalizeNoteName(noteName)]
    ) {
        // Play sample
        const source = playSample(noteName, 0, now, noteGain); // Pass noteGain
        if (source && velocity !== 100) {
            // It's a MIDI note (velocity not 100), track it for note-off
            midiActiveNotes.set(noteName, { source, noteGain });
        } else if (source) {
            // It's a mouse/keyboard click, auto-stop it
            source.stop(now + 0.75);
        }
    } else {
        // fallback to synth
        const osc = audioCtx.createOscillator();
        osc.type = currentInstrument === "piano" ? "sine" : currentInstrument; // Fallback for piano
        osc.frequency.value = noteToFreq(noteName);
        osc.connect(noteGain); // Connect to note-specific gain node

        if (velocity !== 100) {
            // It's a MIDI note, track it for note-off
            osc.start(now);
            midiActiveNotes.set(noteName, { source: osc, noteGain });
        } else {
            // It's a mouse/keyboard click, auto-stop it
            noteGain.gain.linearRampToValueAtTime(0, now + 0.5); // Fade out
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    // if test mode, verify (sequential)
    if (!testActive) return; // If not in test mode, just play the note and return.
    attempts++;
    if (!targetNote) return;
    const correct =
        normalizeNoteName(noteName) === normalizeNoteName(targetNote);
    if (correct) {
        score++;
        keyEl.classList.add("correct");
        testStatus.textContent = "Correct!";
        setTimeout(() => keyEl.classList.remove("correct"), 400);

        // Lock input until next note is played
        inputLocked = true;

        // advance to next note in the melody
        currentTestIndex++;
        const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
        const sample = samples.find((s) => s.id === id) || samples[0];
        if (!sample || currentTestIndex >= (sample.notes || []).length) {
            testStatus.textContent = "Finished — well done!";
            // unlock before stopping to avoid stuck state
            inputLocked = false;
            stopTest();
        } else {
            // set next target (string name)
            const nextNoteObj = sample.notes[currentTestIndex];
            targetNote = nextNoteObj.note;

            // FIX: use user-configurable silent pause before playing the next note
            const pauseSec =
                pauseInput && !isNaN(Number(pauseInput.value))
                    ? Math.max(0, Number(pauseInput.value))
                    : 1;
            const pauseMs = Math.round(pauseSec * 1000);

            // compute actual duration for the next note (in seconds)
            const durBeats = durationMap[nextNoteObj.duration] || 1;
            const durSec =
                (durBeats * 60) /
                Math.max(40, Math.min(220, Number(tempoInput.value) || 90));

            // wait pauseMs (silence), then play the next target and unlock after it finishes
            setTimeout(() => {
                // pass the actual note object so highlighting targets the right occurrence
                const playedDur = playTargetNote(nextNoteObj, durSec);
                setTimeout(() => {
                    inputLocked = false;
                }, Math.round(playedDur * 1000) + 120);
            }, pauseMs);
        }
    } else {
        keyEl.classList.add("wrong");
        testStatus.textContent = "Wrong — try again.";
        setTimeout(() => keyEl.classList.remove("wrong"), 500);
        inputLocked = false; // Unlock input so user can try again immediately
        // do not advance; allow retry
    }
    updateScoreDisplay();
}

function startTest() {
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const sample = samples.find((s) => s.id === id) || samples[0];
    if (!sample) return;
    testActive = true;
    score = 0;
    attempts = 0;
    currentTestIndex = 0; // start at first note
    // set first target note
    const firstNoteObj = (sample.notes && sample.notes[0]) || null;
    targetNote = firstNoteObj ? firstNoteObj.note : null;
    testStatus.textContent = "Test started — listen and click the correct key.";
    startTestBtn.disabled = true;
    stopTestBtn.disabled = false;
    if (targetNote) {
        inputLocked = true;
        // use configurable pause before playing the first note
        const pauseSec =
            pauseInput && !isNaN(Number(pauseInput.value))
                ? Math.max(0, Number(pauseInput.value))
                : 1;
        const pauseMs = Math.round(pauseSec * 1000);
        const bpm = Math.max(40, Math.min(220, Number(tempoInput.value) || 90));
        const durBeats = durationMap[firstNoteObj.duration] || 1;
        const durSec = (durBeats * 60) / bpm;
        setTimeout(() => {
            // pass the actual first note object (so highlight is unambiguous)
            const playedDur = playTargetNote(firstNoteObj, durSec);
            setTimeout(() => {
                inputLocked = false;
            }, Math.round(playedDur * 1000) + 120);
        }, pauseMs);
    }
    updateScoreDisplay();
}

function stopTest() {
    testActive = false;
    targetNote = null;
    currentTestIndex = 0;
    inputLocked = false; // ensure unlocked
    testStatus.textContent = "Test stopped.";
    startTestBtn.disabled = false;
    stopTestBtn.disabled = true;
    updateScoreDisplay();
    // no keyboard highlight to clear
}

fetch(samplePath)
    .then((r) => r.json())
    .then((data) => {
        samples = data.samples || [];
        populateSamples();
        renderSelected();
        // render keyboard after samples / DOM are ready
        loadInstrumentSamples("piano"); // new: load piano samples
        renderKeyboard();
    })
    .catch((err) => console.error("Failed to load samples:", err));

function populateSamples() {
    sampleSelect.innerHTML = "";
    samples.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.title;
        sampleSelect.appendChild(opt);
    });
    sampleSelect.addEventListener("change", renderSelected);
}

function renderSelected() {
    stopPlay();
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const sample = samples.find((s) => s.id === id) || samples[0];
    if (!sample) return;
    titleEl.textContent = sample.title;
    exerciseEl.textContent = sample.exercise || "";
    drawStaff(sample.notes);
}

function drawStaff(notes) {
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const left = 40;
    const right = canvas.width - 40;
    const bottomLineY = 140;
    const lineSpacing = 12;

    // draw 5 staff lines
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = bottomLineY - i * lineSpacing;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }

    // draw notes
    const xStart = left + 10;
    const xGap = Math.min(60, (right - xStart) / Math.max(1, notes.length));
    notes.forEach((n, i) => {
        const noteName = n.note;
        const idx = noteIndexMap[noteName];
        if (typeof idx === "undefined") return;
        // each index step is half of lineSpacing (line -> space -> line)
        const y = bottomLineY - idx * (lineSpacing / 2);
        const x = xStart + i * xGap;

        // ledger lines for notes outside staff
        if (idx <= -1) {
            // draw ledger line for C4 (two ledger lines), D4 (one)
            const ledgerCount =
                Math.abs(Math.min(idx, -1)) + (idx === -2 ? 1 : 0);
            // simpler: draw a ledger centered at note pos if below or above lines
            ctx.beginPath();
            ctx.moveTo(x - 12, y);
            ctx.lineTo(x + 12, y);
            ctx.stroke();
        }
        if (idx >= 5) {
            ctx.beginPath();
            ctx.moveTo(x - 12, y);
            ctx.lineTo(x + 12, y);
            ctx.stroke();
        }

        // draw note head
        ctx.beginPath();
        ctx.fillStyle = "#000";
        ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.stroke();

        // store position for highlighting later
        n._x = x;
        n._y = y;
    });
}

function noteToFreq(note) {
    // parse like C4, D#4, Bb3 not required for current samples but we handle simple sharps/flats
    const m = note.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!m) return 440;
    const letter = m[1].toUpperCase();
    const acc = m[2];
    const octave = parseInt(m[3], 10);

    const semitoneFromC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
    let semitone = semitoneFromC;
    if (acc === "#") semitone += 1;
    if (acc === "b") semitone -= 1;

    // MIDI number for note: C0 = MIDI 12
    const midi = 12 + semitone + octave * 12;
    // A4 is MIDI 69
    const n = midi - 69;
    return 440 * Math.pow(2, n / 12);
}

// --- BEGIN: added missing helpers to fix runtime errors ---
function normalizeNoteName(n) {
    if (!n || typeof n !== "string") return "";
    // uppercase and keep octave
    const m = n.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!m) return n.toUpperCase();
    let letter = m[1].toUpperCase();
    const acc = m[2];
    const octave = m[3];
    // map flats to sharps for a consistent representation
    const flatToSharp = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" };
    const key = (letter + (acc || "")).toUpperCase();
    if (acc === "b") {
        const mapped = flatToSharp[key];
        if (mapped) {
            // mapped contains letter+#, attach octave
            return mapped + octave;
        }
    }
    // handle natural or sharp
    return letter + (acc || "") + octave;
}

function playTargetNote(noteOrObj, durSec = 0.6) {
    // accept either a note object (preferred) or a note name string
    if (!noteOrObj) return 0;
    const isObj = typeof noteOrObj === "object" && noteOrObj.note;
    const name = isObj ? noteOrObj.note : String(noteOrObj);

    const audioCtx = getAudioContext();

    // play sound: check if sample or synth
    if (
        // Use piano samples if selected and loaded
        currentInstrument === "piano" &&
        loadedSamples.piano[normalizeNoteName(name)]
    ) {
        // Play sample
        const source = playSample(name, durSec, audioCtx.currentTime);
        if (source) activeSources.push(source);
    } else {
        const a = audioCtx.currentTime;
        const freq = noteToFreq(name);
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain(); // Use a local gain node for this scheduled note
        osc.type = currentInstrument === "piano" ? "sine" : currentInstrument;
        osc.frequency.value = freq;
        gainNode.gain.value = 0;
        osc.connect(gainNode);
        gainNode.connect(getMasterOutput());
        gainNode.gain.setValueAtTime(0, a);
        // Use a slightly lower max gain for scheduled notes to avoid clipping with multiple notes
        gainNode.gain.linearRampToValueAtTime(0.12, a + 0.02);
        gainNode.gain.setValueAtTime(0.12, a + durSec - 0.05);
        gainNode.gain.linearRampToValueAtTime(0.0, a + durSec);
        osc.start(a);
        osc.stop(a + durSec + 0.02);
        activeSources.push(osc);
    }

    // highlight the exact provided note object if possible, otherwise fall back to find
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const sample = samples.find((s) => s.id === id) || samples[0];
    if (sample) {
        const targetObj = isObj
            ? noteOrObj
            : sample.notes.find(
                  (n) => normalizeNoteName(n.note) === normalizeNoteName(name)
              );
        if (targetObj) {
            highlightNote(targetObj, sample);
            setTimeout(() => drawStaff(sample.notes), durSec * 1000 + 50);
        }
    }
    return durSec;
}

function playSequence(sample) {
    const audioCtx = getAudioContext();
    stopPlay(); // Stop any previous playback
    stopRequested = false;
    const bpm = Math.max(40, Math.min(220, Number(tempoInput.value) || 90));
    const beatSec = 60 / bpm;

    // sequential scheduling
    let cursor = audioCtx.currentTime + 0.1;
    const notes = sample.notes || [];

    notes.forEach((n, idx) => {
        const durBeats = durationMap[n.duration] || 1;
        const durSec = durBeats * beatSec;
        scheduleNote(n.note, cursor, durSec, n, idx, notes);
        cursor += durSec;
    });

    // schedule stop after last note
    playTimer = setTimeout(() => {
        /* done */
    }, Math.ceil((cursor - audioCtx.currentTime) * 1000) + 50);
}

function scheduleNote(noteName, startTime, durSec, noteObj, idx, notes) {
    const audioCtx = getAudioContext();

    // play sound: check if sample or synth
    if (
        // Use piano samples if selected and loaded
        currentInstrument === "piano" &&
        loadedSamples.piano[normalizeNoteName(noteName)]
    ) {
        // Play sample
        const source = playSample(noteName, durSec, startTime);
        if (source) activeSources.push(source);
    } else {
        const freq = noteToFreq(noteName);
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain(); // Use a local gain node for this scheduled note
        osc.type = currentInstrument === "piano" ? "sine" : currentInstrument;
        osc.frequency.value = freq;
        gainNode.gain.value = 0;
        osc.connect(gainNode);
        gainNode.connect(getMasterOutput());

        // ramp
        const a = startTime;
        gainNode.gain.setValueAtTime(0, a);
        // Use a slightly lower max gain for scheduled notes to avoid clipping with multiple notes
        gainNode.gain.linearRampToValueAtTime(0.12, a + 0.01);
        gainNode.gain.setValueAtTime(0.12, a + durSec - 0.05);
        gainNode.gain.linearRampToValueAtTime(0.0, a + durSec);

        osc.start(a);
        osc.stop(a + durSec + 0.02);
        activeSources.push(osc);
    }

    // highlight on canvas
    const highlightDelay = (a - audioCtx.currentTime) * 1000;
    setTimeout(() => {
        if (stopRequested) return;
        highlightNote(noteObj);
    }, Math.max(0, highlightDelay));

    // clear highlight at note end
    setTimeout(() => {
        if (stopRequested) return;
        drawStaff(notes);
    }, Math.max(0, highlightDelay + durSec * 1000));
}

function highlightNote(noteObj, sample) {
    // determine current sample (use provided sample if given)
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const currentSample =
        sample || samples.find((s) => s.id === id) || samples[0];
    if (!currentSample || !currentSample.notes) return;

    // redraw the staff for the current sample to clear any previous highlights
    drawStaff(currentSample.notes);

    if (!noteObj) return;

    // ensure we have coordinates for the note; if not, find matching note in sample
    let target = noteObj;
    if (typeof target._x === "undefined" || typeof target._y === "undefined") {
        const match = currentSample.notes.find(
            (n) => normalizeNoteName(n.note) === normalizeNoteName(noteObj.note)
        );
        if (match) target = match;
    }

    if (typeof target._x === "undefined") return;

    // draw highlight ellipse on top of freshly drawn staff
    ctx.beginPath();
    ctx.fillStyle = "#d24";
    ctx.ellipse(target._x, target._y, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
}

function stopPlay() {
    stopRequested = true;
    if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
    }
    // Stop all active audio sources
    activeSources.forEach((source) => {
        try {
            source.stop();
        } catch (e) {
            /* already stopped */
        }
    });
    midiActiveNotes.clear(); // Clear any lingering MIDI notes
    activeSources = []; // Clear the array

    // re-render current
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const sample = samples.find((s) => s.id === id) || samples[0];
    if (sample) drawStaff(sample.notes);
}

playBtn.addEventListener("click", () => {
    const id = Number(sampleSelect.value) || (samples[0] && samples[0].id);
    const sample = samples.find((s) => s.id === id) || samples[0];
    if (!sample) return;
    playSequence(sample);
});

stopBtn.addEventListener("click", stopPlay);

// initial select default
if (sampleSelect.options.length > 0 && !sampleSelect.value) {
    sampleSelect.selectedIndex = 0;
    renderSelected();
}

// removed DOMContentLoaded block that referenced a non-existent #start-button
// wire test buttons and render keyboard safely
if (typeof document !== "undefined") {
    // render keyboard if not already rendered
    try {
        renderKeyboard();
    } catch (e) {}

    if (startTestBtn) startTestBtn.addEventListener("click", startTest);
    if (stopTestBtn) stopTestBtn.addEventListener("click", stopTest);

    // legacy / optional element guard (safe)
    const legacyStart = document.getElementById("start-button");
    if (legacyStart) legacyStart.addEventListener("click", startTest);
}

// --- new: AudioContext singleton ---
/**
 * Gets or creates a single AudioContext instance.
 * This is crucial for performance and preventing audio glitches.
 * @returns {AudioContext} The singleton AudioContext instance.
 */
function getAudioContext() {
    if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Initialize master gain node for volume control
        masterGain = audioCtx.createGain();
        masterGain.gain.value = audioSettings.volume; // from settings
        masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
}

/**
 * Gets the master gain node for routing audio output.
 * All audio should connect through this node so volume can be controlled.
 * @returns {GainNode} The master gain node.
 */
function getMasterOutput() {
    const ctx = getAudioContext();
    if (!masterGain || masterGain.context !== ctx) {
        // Recreate if missing or context was recreated
        masterGain = ctx.createGain();
        masterGain.gain.value = audioSettings.volume;
        masterGain.connect(ctx.destination);
    }
    return masterGain;
}
// --- new: audio sample handling ---

/**
 * Plays a pre-loaded audio sample.
 * @param {string} noteName - The name of the note to play.
 * @param {number} [duration=1] - The duration to play the note for.
 * @param {number} [startTime] - The AudioContext time to start playing.
 * @param {GainNode} [outputNode] - Optional output node (e.g., a note-specific gain node for MIDI).
 * @returns {AudioBufferSourceNode|null} The created source node, or null if buffer not found.
 */
function playSample(noteName, duration = 1, startTime, outputNode) {
    const audioCtx = getAudioContext();
    const normNote = normalizeNoteName(noteName);
    const buffer = loadedSamples.piano[normNote];
    if (!buffer) return null;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outputNode || getMasterOutput()); // Connect to provided output or master gain
    // For samples, we typically let them play to their natural end unless explicitly stopped.
    // If duration is 0, it means play to end. Otherwise, play for specified duration.
    source.start(startTime, 0, duration > 0 ? duration : buffer.duration);

    return source;
}

/**
 * Loads all audio samples for a given instrument.
 * @param {string} instrumentName - The name of the instrument (e.g., "piano").
 */
async function loadInstrumentSamples(instrumentName) {
    const audioCtx = getAudioContext();
    const promises = keyboardNotes.map((noteName) => {
        const normNote = normalizeNoteName(noteName);

        // Reverted to simple naming: C4.wav, C#4.wav, etc.
        const sampleFilename = `${normNote.replace(/#/g, "%23")}.wav`;
        const sampleUrl = `../../public/audio/piano/Grandma_Beachhouse_Piano/${sampleFilename}`;

        return fetch(sampleUrl)
            .then((response) => {
                if (!response.ok)
                    throw new Error(`Sample not found: ${sampleUrl}`);
                return response.arrayBuffer();
            })
            .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
            .then((audioBuffer) => {
                loadedSamples[instrumentName][normNote] = audioBuffer;
            })
            .catch((error) => {
                // Don't log for every single note if the folder is missing
                if (noteName === "C4")
                    console.warn(
                        `Could not load piano samples. The synth will be used as a fallback. Error: ${error.message}`
                    );
            });
    });
    await Promise.all(promises);
    console.log(`${instrumentName} samples loaded.`);
}

// --- new: instrument change handler ---
if (instrumentSelect) {
    instrumentSelect.addEventListener(
        "change",
        (e) => (currentInstrument = e.target.value)
    );
}

// --- new: settings wiring ---
function applySettingsToUI() {
    if (volumeSlider) volumeSlider.value = Math.round((audioSettings.volume || 0) * 100);
    if (midiCapInput) midiCapInput.value = String(audioSettings.midiGainCap);
    if (midiCurveInput) midiCurveInput.value = String(audioSettings.midiCurve);
    if (midiAttackMsInput)
        midiAttackMsInput.value = String(Math.round((audioSettings.midiAttackSec || 0) * 1000));
    if (midiReleaseMsInput)
        midiReleaseMsInput.value = String(Math.round((audioSettings.midiReleaseSec || 0) * 1000));
}

function applySettingsToAudio() {
    const master = getMasterOutput();
    if (master) {
        const now = master.context.currentTime;
        master.gain.setTargetAtTime(audioSettings.volume, now, 0.01);
    }
}

applySettingsToUI();
applySettingsToAudio();

if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
        const volume = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
        audioSettings.volume = volume;
        saveAudioSettings(audioSettings);
        applySettingsToAudio();
    });
}

if (midiCapInput) {
    midiCapInput.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        audioSettings.midiGainCap = isNaN(v) ? defaultAudioSettings.midiGainCap : Math.max(0, Math.min(1, v));
        saveAudioSettings(audioSettings);
    });
}
if (midiCurveInput) {
    midiCurveInput.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        audioSettings.midiCurve = isNaN(v) ? defaultAudioSettings.midiCurve : Math.max(1, Math.min(3, v));
        saveAudioSettings(audioSettings);
    });
}
if (midiAttackMsInput) {
    midiAttackMsInput.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        const clamped = isNaN(v) ? (defaultAudioSettings.midiAttackSec * 1000) : Math.max(0, Math.min(50, v));
        audioSettings.midiAttackSec = clamped / 1000;
        saveAudioSettings(audioSettings);
    });
}
if (midiReleaseMsInput) {
    midiReleaseMsInput.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        const clamped = isNaN(v) ? (defaultAudioSettings.midiReleaseSec * 1000) : Math.max(0, Math.min(200, v));
        audioSettings.midiReleaseSec = clamped / 1000;
        saveAudioSettings(audioSettings);
    });
}

if (resetAudioSettingsBtn) {
    resetAudioSettingsBtn.addEventListener("click", () => {
        audioSettings = { ...defaultAudioSettings };
        saveAudioSettings(audioSettings);
        applySettingsToUI();
        applySettingsToAudio();
    });
}

// --- new: computer keyboard input ---
document.addEventListener("keydown", (e) => {
    // avoid triggering on repeated keys from holding a key down
    if (e.repeat) return;
    const noteName = keyToNoteMap[e.key.toLowerCase()];
    if (noteName) {
        const keyEl = keyboardEl.querySelector(`[data-note="${noteName}"]`);
        if (keyEl) {
            keyEl.classList.add("active");
            handleKeyClick(noteName, keyEl);
            // remove active class after a short delay
            setTimeout(() => keyEl.classList.remove("active"), 200);
        }
    }
});

// --- new: MIDI keyboard input ---

/**
 * Converts a MIDI note number to a note name (e.g., 60 -> "C4").
 * @param {number} midiNote - The MIDI note number (0-127).
 * @returns {string} The note name.
 */
function midiToNoteName(midiNote) {
    const noteNames = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
    ];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return noteNames[noteIndex] + octave;
}

/**
 * Handles incoming MIDI messages.
 * @param {MIDIMessageEvent} message - The MIDI message event.
 */
function handleMidiMessage(message) {
    console.log("MIDI message received:", message.data);
    const [command, noteNumber, velocity] = message.data;

    // 0x90 is Note On for channel 0. We'll listen to all channels (0x90-0x9F).
    const isNoteOn = (command & 0xf0) === 0x90 && velocity > 0;
    // 0x80 is Note Off. A Note On with velocity 0 is also a Note Off.
    const isNoteOff = (command & 0xf0) === 0x80 || isNoteOn === false;

    const noteName = midiToNoteName(noteNumber);
    const keyEl = keyboardEl.querySelector(`[data-note="${noteName}"]`);

    console.log(
        `MIDI Note: ${noteNumber} -> ${noteName}, Velocity: ${velocity}, Key Element found: ${!!keyEl}`
    );

    if (isNoteOn) {
        if (keyEl) {
            keyEl.classList.add("active");
            handleKeyClick(noteName, keyEl, velocity); // Pass velocity to handleKeyClick
            console.log(`MIDI Note On: ${noteName}`);
        }
    } else if (isNoteOff) {
        if (keyEl) {
            keyEl.classList.remove("active");
            console.log(`MIDI Note Off: ${noteName}`);

            // Stop the corresponding audio source for this note
            const activeNote = midiActiveNotes.get(noteName);
            if (activeNote) {
                const { source, noteGain } = activeNote;
                const now = audioCtx.currentTime;
                // Ramp down gain to avoid clicks, then stop
                noteGain.gain.cancelScheduledValues(now);
                const rel = Math.max(0.005, audioSettings.midiReleaseSec);
                noteGain.gain.linearRampToValueAtTime(0, now + rel);
                source.stop(now + rel);
                // Disconnect to free up resources
                source.disconnect();
                noteGain.disconnect();
                midiActiveNotes.delete(noteName); // Remove from active notes
            }
        }
    }
}

/**
 * Initializes MIDI input.
 */
function initMidi() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(
            (midiAccess) => {
                console.log("MIDI access granted.");

                const setupMidiInputs = () => {
                    let connectedInputs = 0;
                    for (const input of midiAccess.inputs.values()) {
                        // Only assign if not already assigned to prevent multiple listeners
                        if (input.onmidimessage !== handleMidiMessage) {
                            input.onmidimessage = handleMidiMessage;
                            console.log(
                                `Listening to MIDI input: ${input.name}`
                            );
                        }
                        connectedInputs++;
                    }
                    if (midiStatusEl) {
                        midiStatusEl.textContent =
                            connectedInputs > 0
                                ? `MIDI: Connected (${connectedInputs} device${
                                      connectedInputs > 1 ? "s" : ""
                                  })`
                                : "MIDI: No devices found";
                    }
                };

                setupMidiInputs(); // Initial setup

                // Listen for future connections/disconnections
                midiAccess.onstatechange = (e) => {
                    console.log(
                        `MIDI device state change: ${e.port.name} ${e.port.state}`
                    );
                    // Re-run setup to update status and handle new/removed devices
                    setupMidiInputs();
                };
            },
            () => {
                // Error callback
                console.error("MIDI access denied by user.");
                if (midiStatusEl)
                    midiStatusEl.textContent = "MIDI: Access Denied";
            }
        );
    } else {
        console.log("Web MIDI API is not supported in this browser."); // Browser doesn't support Web MIDI
        if (midiStatusEl) midiStatusEl.textContent = "MIDI: Not Supported";
    }
}

initMidi(); // Initialize MIDI on script load
