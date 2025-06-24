import {
  damageDistribution,
  deletePlayersIds,
  dicesRoll,
  getActivePlayer,
  getAttackResult,
  getDamage,
  getNextPlayerId,
  getPlayerById,
  getValuesByIndex,
  sumArray,
} from '../functions/functions.js';
import Game from '../models/Game.js';
import pusher from '../pusher.js';
import mongoose from 'mongoose';

/**
 * Event=> - playerTurn (Donne la personne qui joue) (on pourra mettre si c'est un lancé pour la survie ou l'attaque)
 *         - Résulat des dés
 *         - Vérouillage des dés
 */

// TODO faire un truc pour que les parties pas modifiees depuis un certain temps soient supprimées de la base de données

// Crée un lobby dans la database
export const createALobby = async (req, res) => {
  console.log('in createALobby service');
  try {
    const game = new Game({
      private: req.body.private,
      host: req.body.user,
      players: [
        {
          username: req.body.user.username,
          id: req.body.user.id,
          ready: true,
        },
      ],
    });
    const savedGame = await game.save();

    return res.status(201).send(savedGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur createALobby:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

// Récupère un lobby dans la database
export const getALobby = async (req, res) => {
  console.log('in getALobby service');
  try {
    const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });

    if (!game) {
      return res.status(404).send('Aucun Lobby trouvé');
    }
    res.status(200).send(game);
  } catch (error) {
    console.error('Erreur dans le contrôleur getALobby:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

// Service qui récupère le user (username et id) et l'ajoute dans la liste des joueurs de la partie
export const addAPlayer = async (req, res) => {
  console.log('in addAPlayer service');
  const { id, user } = req.body;

  try {
    const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!game) {
      return res.status(404).send('Aucun Lobby trouvé');
    }

    game.players.push(user);

    const newGame = await Game.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { players: game.players } },
      { new: true },
    );

    await pusher.trigger(`DollarCanadien-${id}`, 'updatePlayers', deletePlayersIds(game).players);
    return res.status(201).send(newGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur addAPlayer:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

// Service qui met à jour si je joueur est prêt ou non
export const readyUp = async (req, res) => {
  console.log('in readyUp service');
  const { id, user } = req.body;

  const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });

  if (!game) {
    return res.status(404).send('Aucun Lobby trouvé');
  }

  const playerIndex = getPlayerById(game, user);
  if (playerIndex === -1) return res.status(404).send('Aucun Joueur avec cet id trouvé');

  game.players[playerIndex].ready = !game.players[playerIndex].ready;

  try {
    const updatedGame = await Game.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, game);

    await pusher.trigger(`DollarCanadien-${id}`, 'updatePlayers', deletePlayersIds(game).players);
    return res.status(201).send(updatedGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur getALobby:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

// Allow to iniziliaze and start a game in the database
export const startGame = async (req, res) => {
  console.log('in startGame service');
  const { id, user } = req.body;

  try {
    let everyoneIsReady = true;
    const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!game) return res.status(404).send('Aucun Lobby trouvé.');
    if (game.actif) return res.status(409).send('La partie est déjà lancé.');
    if (game.host.id !== user.id)
      return res.status(403).send("Vous n'avez pas l'autorité pour faire ça.");
    if (game.players.length <= 1)
      return res.status(422).send('Pas assez de joueurs pour lancer la partie.');

    game.players.forEach((player) => {
      if (player.ready === false) everyoneIsReady = false;
    });
    if (!everyoneIsReady) return res.status(409).send('Tout les joueurs ne sont pas prêt.');

    // Assigne automatiquement le champ `actif` a un joueur si il est vide.
    if (!game.actif && game.players.length > 0) {
      game.actif = game.players[0]._id;
      game.players[0].dices.push(...dicesRoll(6));
    }

    // Initialise les index des joueurs par leur index
    game.players.forEach((player, index) => {
      if (!player.index) {
        player.index = index;
      }
    });

    const ActifPlayer = getActivePlayer(game);

    ActifPlayer.dices = dicesRoll(6);

    const updatedGame = await Game.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: game },
      { new: true },
    );

    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient
    await pusher.trigger(`DollarCanadien-${id}`, 'updateGame', deletePlayersIds(updatedGame));

    return res.status(201).send('La partie a bien été lancé.');
  } catch (error) {
    console.error('Erreur dans le contrôleur startGame:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const lockDices = async (req, res) => {
  console.log('in lockDices service');
  const { id, user, lockedDices } = req.body;

  const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });
  const activePlayer = getActivePlayer(game);

  if (user.id !== activePlayer._id) return res.status(500).send('Pas ton tour mon grand >:(');

  const newLockedDices = getValuesByIndex(activePlayer.dices, lockedDices);
  activePlayer.lockedDices.push(...newLockedDices);

  if (activePlayer.lockedDices.length !== 6) {
    activePlayer.dices = dicesRoll(6 - activePlayer.lockedDices.length);
    game.step = 'none';
  } else {
    const score = sumArray(activePlayer.lockedDices);
    if (score < 30) {
      activePlayer.hp -= 30 - score;
    } else {
      const attack = score - 30;

      // create the attack results (array of arrays)
      const attackResult = getAttackResult(attack);
      activePlayer.attackDices = attackResult;
      const totalDamage = getDamage(attackResult, attack);
      damageDistribution(game, game.actif, attack, totalDamage);
    }
    activePlayer.dices = [];

    game.step = 'scoreAdditionAnimation';
  }

  try {
    const updatedGame = await Game.findByIdAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: game },
      { new: true },
    );
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // je veux dire que l'id du joueur actif et l'id du host sont disponible pour tout le monde donc on pourrait les utiliser pour tricher

    // TODO faire deux pusher en fonction de si ça change de joueur actif ou non
    await pusher.trigger(`DollarCanadien-${id}`, 'updateGame', updatedGame);

    res.status(200).send(updatedGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur lockedDices:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const endTurn = async (req, res) => {
  console.log('in endTurn service');
  const { id, user } = req.body;

  const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });
  const activePlayer = getActivePlayer(game);

  if (user.id !== activePlayer._id) return res.status(500).send('Pas ton tour mon grand >:(');

  if (activePlayer.lockedDices.length !== 6) {
    res.status(500).send("Le joueur actif n'a pas verrouillé 6 dés.");
    return;
  } else {
    // TODO changer pour pas faire jouer le mec si il reste que lui (que le joueur actuel est mort et quil est le dernier) (normalelement c'est bon mais je laisse pour validation)
    // TODO revoir on affiche pas le bon joueur quand c'est le joueur actif qui meurt
    const nextPlayerId = getNextPlayerId(game);
    if (nextPlayerId) {
      game.actif = nextPlayerId;
      game.step = 'none';
    } else {
      game.step = 'gameEnd';
    }
    const nextActivePlayer = getActivePlayer(game);
    nextActivePlayer.attackDices = [];
    nextActivePlayer.dices = dicesRoll(6);
    nextActivePlayer.lockedDices = [];
  }

  try {
    const updatedGame = await Game.findByIdAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: game },
      { new: true },
    );
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // TODO Y'a un probleme avec le actif actuelle, et le host ils ont tout les deux leurs ids quand on les renvoient free triche
    // je veux dire que l'id du joueur actif et l'id du host sont disponible pour tout le monde donc on pourrait les utiliser pour tricher

    // TODO faire deux pusher en fonction de si ça change de joueur actif ou non
    await pusher.trigger(`DollarCanadien-${id}`, 'updateGame', updatedGame);

    res.status(200).send(updatedGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur lockedDices:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

// TODO atm ca fait juste sa fonction mais tres possible de hack ca (en gros mettre des securités)
export const changeGameStep = async (req, res) => {
  console.log('in changeGameStep service');
  const { id, user, step } = req.body;

  try {
    const updatedGame = await Game.findByIdAndUpdate(id, { $set: { step } }, { new: true });

    // TODO faire un troisieme pusher pour le step ?? (pour l'instant ca marche juste pas opti)
    await pusher.trigger(`DollarCanadien-${id}`, 'updateGame', updatedGame);
    res.status(200).send(updatedGame);
  } catch (error) {
    console.error('Erreur dans le contrôleur lockedDices:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const test = async (req, res) => {
  console.log('in test service');
  const { id, user } = req.body;
  console.log('id', id);
  const game = await Game.findOne({ _id: new mongoose.Types.ObjectId(id) });
  console.log('game', game);

  res.status(200);
};
