// TODO découper ce fichier en plusieurs plus petit

/**
 * Rolls a specified number of 6-sided dice and returns the results.
 *
 * @param {number} diceNumber - The number of dice to roll.
 * @returns {number[]} An array of dice roll results.
 */
export const dicesRoll = (diceNumber) => {
  const dicesResults = [];
  for (let i = 0; i < diceNumber; i++) {
    dicesResults.push(Math.floor(Math.random() * 6) + 1);
  }
  return dicesResults;
};

// TODO supprimer celle la et la remplacer par getPlayerById
/**
 * Gets the active player from the game based on the `actif` property.
 *
 * @param {Game} game - The game object containing players and the active player's ID.
 * @returns {Player} The active player object.
 */
export const getActivePlayer = (game) => {
  const activeId = game.actif;
  return game.players.filter((player) => player._id == activeId)[0];
};

/**
 * Finds the index of a player in a game based on their ID and username.
 *
 * @param {Game} game - The game object containing a list of players.
 * @param {User} user - The user object to search for within the game's players.
 * @returns {number} The index of the player in the game's players array, or -1 if not found.
 */
export const getPlayerById = (game, user) => {
  return game.players.findIndex(
    (player) => player._id === user.id && player.username === user.username,
  );
};

/**
 * Removes the `_id` property from all players in the game to avoid cheating.
 *
 * @param {Game} game - The game object containing players.
 * @returns {Game} The updated game object with players' IDs removed.
 */
export const deletePlayersIds = (game) => {
  if (Array.isArray(game.players)) {
    game.players = game.players.map((player) => {
      delete player._id;
      return player;
    });
  }
  return game;
};

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

    // Si aucun dé ne montre attackNumber, on arrête
    if (countAttackNumber === 0) {
      condition = false;
      // Sinon, réduire le nombre de dés restants
    } else {
      remainingDice -= countAttackNumber;

      // Si plus de dés restants, on relance les 6 dés
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
 * Gets the ID of the next player in the game.
 *
 * @param {Game} game - The game object containing players and the active player's ID.
 * @returns {string | null} The ID of the next player or null if no other player alive.
 */
export const getNextPlayerId = (game) => {
  const activePlayerId = game.actif;
  const validPlayers = game.players.filter((player) => player.hp > 0);
  if (validPlayers.length === 1) {
    console.log("Plus qu'un joueur vivant");
    return null;
  }

  const currentIndex = validPlayers.findIndex((player) => player._id == activePlayerId);
  if (currentIndex === -1) {
    console.error('Joueur actif non trouvé dans la liste des joueurs');
    return null;
  }
  const nextIndex = (currentIndex + 1) % validPlayers.length;

  return validPlayers[nextIndex]._id;
};

/**
 * Distributes damage to valid targets in the game.
 *
 * @param {Game} game - The game object containing players and their health points.
 * @param {string} attackerId - The ID of the attacking player.
 * @param {number} number - A number used to determine the target index.
 * @param {number} damage - The total amount of damage to distribute.
 * @returns {Player[]} The updated list of players with adjusted health points.
 */
export const damageDistribution = (game, attackerId, number, damage) => {
  const validTargets = game.players.filter((player) => player._id !== attackerId && player.hp > 0);
  if (validTargets.length === 0) return game.players;

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
