import {
  dicesRoll,
  getActivePlayer,
  getAttackResult,
  getDamage,
  getNextPlayerId,
  getValuesByIndex,
} from '../functions/functions.js';
import Game from '../models/Game.js';
import pusher from '../pusher.js';

/** 
* Event=> - playerTurn (Donne la personne qui joue) (on pourra mettre si c'est un lancé pour la survie ou l'attaque)
          - Résulat des dés 
          - Vérouillage des dés 
*/

// Allow to iniziliaze and start a game in the database
export const startGame = async (req, res) => {
  console.log('in startGame service');
  try {
    const game = new Game({
      players: req.body.players.map((name) => ({
        username: name,
      })),
    });
    const savedGame = await game.save();

    await pusher.trigger(`DollarCanadien-${req.body.idRoom}`, 'GameStart', savedGame);

    res.status(201).send('La partie a bien été créé.');
  } catch (error) {
    console.error('Erreur dans le contrôleur startGame:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const lockDices = async (req, res) => {
  console.log('lockDices');

  const lockedDicesIndexes = req.body.lockedDices;
  console.log(lockedDicesIndexes);

  const game = await Game.findOne({ _id: req.body.idGame });
  console.log(game);

  const activePlayer = getActivePlayer(game);
  console.log(activePlayer);

  const newLockedDices = getValuesByIndex(activePlayer.dicesRoll, lockedDicesIndexes);
  console.log(newLockedDices);

  activePlayer.lockedDices.push(newLockedDices);
  console.log(activePlayer.lockedDices);

  if (activePlayer.lockedDices.length === 6) {
    console.log(activePlayer.dices);
    activePlayer.dices = dicesRoll(6 - activePlayer.lockedDices.length);
    console.log(activePlayer.dices);
  } else {
    const score = sumArray(activePlayer.dices);
    if (score < 30) {
      activePlayer.hp -= score;
    } else {
      const attack = score - 30;
      console.log(attack);

      const attackResult = getAttackResult(attack);
      console.log(attackResult);
      // TODO mettre ça dans une variable dans player

      const damage = getDamage(attackResult, attack);
      console.log(damage);
      // TODO enlever ça des HP de la/les victime/s
    }
  }

  game.actif = getNextPlayerId(game);

  try {
    const payload = {
      idGame: game.id,
      game: game,
    };
    await pusher.trigger(`DollarCanadien-${payload.idGame}`, 'lockedDices', payload);
    res.status(200).send(payload);
  } catch (error) {
    console.error('Erreur dans le contrôleur lockedDices:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};
