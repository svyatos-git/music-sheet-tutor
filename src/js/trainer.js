// This file contains the training logic for the music sheet tutor application.
// It includes functions for generating exercises and tracking user progress.

class Trainer {
    constructor() {
        this.exercises = [];
        this.currentExerciseIndex = 0;
        this.userProgress = {};
    }

    generateExercise(note) {
        const exercise = {
            note: note,
            isCorrect: null
        };
        this.exercises.push(exercise);
        return exercise;
    }

    checkAnswer(userAnswer) {
        const currentExercise = this.exercises[this.currentExerciseIndex];
        currentExercise.isCorrect = (userAnswer === currentExercise.note);
        this.trackProgress(currentExercise);
        this.currentExerciseIndex++;
    }

    trackProgress(exercise) {
        const note = exercise.note;
        if (!this.userProgress[note]) {
            this.userProgress[note] = { correct: 0, total: 0 };
        }
        this.userProgress[note].total++;
        if (exercise.isCorrect) {
            this.userProgress[note].correct++;
        }
    }

    getProgress() {
        return this.userProgress;
    }

    reset() {
        this.exercises = [];
        this.currentExerciseIndex = 0;
        this.userProgress = {};
    }
}

// Export the Trainer class for use in other modules
export default Trainer;