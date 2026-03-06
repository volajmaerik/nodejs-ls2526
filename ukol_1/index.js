const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });

// Random number from 0 to 10 (inclusive)
const hiddenNumber = Math.floor(Math.random() * 11);

const MAX_ATTEMPTS = 5;
let attempt = 0;

console.log("Guess a number from 0 to 10. You have 5 attempts.");

rl.on("line", (input) => {
  const guess = Number(input);
  attempt++;

  if (isNaN(guess)) {
    console.log("Please enter a number.");
    return;
  }

  if (guess === hiddenNumber) {
    console.log(`Correct! You guessed the number ${hiddenNumber} on attempt ${attempt}.`);
    rl.close();
    return;
  }

  if (guess < hiddenNumber) {
    console.log("Too low.");
  } else {
    console.log("Too high.");
  }

  if (attempt >= MAX_ATTEMPTS) {
    console.log(`Game over! The secret number was ${hiddenNumber}.`);
    rl.close();
    return;
  }

  console.log(`Try again. Attempts remaining: ${MAX_ATTEMPTS - attempt}`);
});
