// This file contains functions and classes related to music notation, such as parsing sheet music and displaying notes.

class Note {
    constructor(name, octave, duration) {
        this.name = name;
        this.octave = octave;
        this.duration = duration;
    }

    getFrequency() {
        const A4_FREQUENCY = 440; // Frequency of A4
        const noteFrequencies = {
            'C': -9,
            'C#': -8,
            'D': -7,
            'D#': -6,
            'E': -5,
            'F': -4,
            'F#': -3,
            'G': -2,
            'G#': -1,
            'A': 0,
            'A#': 1,
            'B': 2
        };
        const semitoneOffset = noteFrequencies[this.name] + (this.octave - 4) * 12;
        return A4_FREQUENCY * Math.pow(2, semitoneOffset / 12);
    }
}

function parseSheetMusic(sheet) {
    // This function will parse the sheet music and return an array of Note objects
    const notes = [];
    const lines = sheet.split('\n');
    
    lines.forEach(line => {
        const [name, octave, duration] = line.split(' ');
        if (name && octave && duration) {
            notes.push(new Note(name, parseInt(octave), parseFloat(duration)));
        }
    });

    return notes;
}

function displayNotes(notes) {
    const notesContainer = document.getElementById('notes-container');
    notesContainer.innerHTML = ''; // Clear previous notes

    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.textContent = `${note.name}${note.octave} (${note.duration})`;
        notesContainer.appendChild(noteElement);
    });
}