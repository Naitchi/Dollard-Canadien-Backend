export const dicesRoll = (diceNumber) => {
  const dicesResults = [];
  for (let i = 0; i < diceNumber; i++) {
    dicesResults.push(Math.floor(Math.random() * (6 - 1) + 1));
  }
  return dicesResults;
};
