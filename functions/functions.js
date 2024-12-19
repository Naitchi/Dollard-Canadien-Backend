export const dicesRoll = (diceNumber) => {
  const dicesResults = [];
  for (let i = 0; i < diceNumber; i++) {
    dicesResults.push(Math.floor(Math.random() * (6 - 1) + 1));
  }
  return dicesResults;
};
export const getActivePlayer = (game) => {
  const activeId = game.actif;
  return game.players.filter((player) => player.id === activeId)[0];
};

export const getValuesByIndex = (arrayOfValues, arrayOfIndexes) => {
  if (!Array.isArray(arrayOfValues) || !Array.isArray(arrayOfIndexes)) {
    throw new Error('Les deux arguments doivent être des tableaux');
  }
  return arrayOfIndexes.map((index) => {
    console.log('index:', index);
    console.log('arrayOfValues.length:', arrayOfValues.length);

    if (index < 0 || index >= arrayOfValues.length) {
      throw new Error(`Index hors des limites : ${index}`);
    }
    return arrayOfValues[arrayOfIndexes];
  });
};

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

export const getAttackResult = (attackNumber) => {
  const results = [];
  let result;
  let number = 0;
  let condition = true;
  do {
    const modifier = ((attackNumber - 1 + number) % 6) + 1; // Roll les nombres différents avant 6
    result = dicesRoll(modifier);
    results.push(result);

    // Compte le nombre de attackNumber dans le résultat
    const count = result.filter((value) => value === attackNumber).length;
    if (count === 0) {
      condition = false;
    } else {
      number += count; // Incrémente number selon le nombre d'attackNumber
    }
  } while (condition);
  console.log(results);

  return results;
};

export const getDamage = (attackResults, attackNumber) => {
  return attackResults.reduce((sum, roll) => {
    return sum + roll.filter((value) => value === attackNumber).length;
  }, 0);
};

export const getNextPlayerId = (game) => {
  const activePlayerId = game.actif;
  const players = game.players;
  const currentIndex = players.findIndex((player) => player._id == activePlayerId);
  if (currentIndex === -1) {
    throw new Error('Joueur actif non trouvé dans la liste des joueurs');
  }
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex]._id;
};
