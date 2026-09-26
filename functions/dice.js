import crypto from 'crypto';

/**
 * Rolls a specified number of 6-sided dice and returns the results.
 *
 * Uses a cryptographic RNG: Math.random() isn't one, and since every die
 * rolled is public, a player could rebuild its internal state from them and
 * predict their next rolls.
 *
 * @param {number} diceNumber - The number of dice to roll.
 * @returns {number[]} An array of dice roll results.
 */
export const dicesRoll = (diceNumber) => {
  const dicesResults = [];
  for (let i = 0; i < diceNumber; i++) {
    dicesResults.push(crypto.randomInt(1, 7));
  }
  return dicesResults;
};

/**
 * Checks a selection of dice indexes sent by the client: at least one die,
 * only integer indexes that exist, and no index selected twice (otherwise the
 * same die could be locked several times).
 *
 * @param {any} selection - The selected indexes from the request body.
 * @param {number} diceCount - The number of dice currently rolled.
 * @returns {boolean} True if the selection is valid.
 */
export const isValidDiceSelection = (selection, diceCount) =>
  Array.isArray(selection) &&
  selection.length > 0 &&
  selection.every((index) => Number.isInteger(index) && index >= 0 && index < diceCount) &&
  new Set(selection).size === selection.length;

/**
 * Retrieves values from an array based on an array of indexes.
 *
 * @param {any[]} arrayOfValues - The array of values to retrieve from.
 * @param {number[]} arrayOfIndexes - The array of indexes to retrieve values for.
 * @returns {any[]} An array of values corresponding to the provided indexes.
 */
export const getValuesByIndex = (arrayOfValues, arrayOfIndexes) => {
  if (!Array.isArray(arrayOfValues) || !Array.isArray(arrayOfIndexes)) {
    throw new Error('Les deux arguments doivent être des tableaux');
  }
  return arrayOfIndexes.map((index) => {
    if (index < 0 || index >= arrayOfValues.length) {
      throw new Error(`Index hors des limites : ${index}`);
    }
    return arrayOfValues[index];
  });
};

/**
 * Sums the values in an array.
 *
 * @param {number[]} array - The array of numbers to sum.
 * @returns {number} The sum of the array's values.
 */
export const sumArray = (array) => {
  if (!Array.isArray(array)) {
    throw new Error("L'entrée doit être un tableau");
  }
  return array.reduce((sum, current) => {
    if (typeof current !== 'number') {
      throw new Error(`Valeur non numérique trouvée : ${current}`);
    }
    return sum + current;
  }, 0); // Valeur initiale
};
