import { dicesRoll } from './dice.js';

/**
 * Calculates attack results based on the attack number.
 *
 * @param {number} attackNumber - The number representing the attack.
 * @returns {number[][]} An array of arrays, each containing dice roll results.
 */
export const getAttackResult = (attackNumber) => {
  const results = [];
  let remainingDice = 6;
  let condition = true;

  do {
    const result = dicesRoll(remainingDice);

    results.push(result);

    const countAttackNumber = result.filter((value) => value === attackNumber).length;

    if (countAttackNumber === 0) {
      condition = false;
    } else {
      remainingDice -= countAttackNumber;

      if (remainingDice <= 0) {
        remainingDice = 6;
      }
    }
  } while (condition);

  return results;
};

/**
 * Calculates the total damage dealt based on attack results.
 *
 * @param {number[][]} attackResults - An array of arrays representing attack results.
 * @param {number} attackNumber - The attack number to count in the results.
 * @returns {number} The total damage dealt.
 */
export const getDamage = (attackResults, attackNumber) => {
  const numberOfDices = attackResults.reduce((sum, roll) => {
    return sum + roll.filter((value) => value === attackNumber).length;
  }, 0);
  return numberOfDices * attackNumber;
};

/**
 * Distributes damage to valid targets in the game.
 *
 * @param {Game} game - The game object containing players and their health points.
 * @param {string} attackerId - The ID of the attacking player.
 * @param {number} number - A number used to determine the target index.
 * @param {number} damage - The total amount of damage to distribute.
 * @returns {Game} The updated game object with players' health points adjusted.
 */
export const damageDistribution = (game, attackerId, number, damage) => {
  const validTargets = game.players.filter((player) => player._id !== attackerId && player.hp > 0);
  if (validTargets.length === 0) return game;

  let targetIndex = number % validTargets.length;
  let dmgToDeal = damage;

  while (dmgToDeal > 0) {
    let target = validTargets[targetIndex];
    if (target.hp >= dmgToDeal || validTargets.length == 1) {
      game.players[target.index].hp -= dmgToDeal;
      dmgToDeal = 0;
    } else {
      dmgToDeal -= target.hp;
      game.players[target.index].hp = 0;
      validTargets.splice(targetIndex, 1);
    }
    targetIndex = (targetIndex + 1) % validTargets.length;

    if (validTargets.length === 0) {
      return game;
    }
  }
  return game;
};
