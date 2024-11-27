import { dicesRoll } from '../fonctions/fonctions.js';
import pusher from '../pusher.js';

/** 
* Event=> - playerTurn (Donne la personne qui joue) (on pourra mettre si c'est un lancé pour la survie ou l'attaque)
          - Résulat des dés 
          - Vérouillage des dés 
*/

export const playerTurn = async (req, res) => {
  console.log('playerTurn');
  try {
    // on donne le joueur qui joue et donc on doit passé la liste et ça se déclanche quand le mec à fini son tour
    const payload = req.body;
    await pusher.trigger(`DollarCanadien-${payload.idRoom}`, 'playerTurn', payload);
    res.status(201).send(payload);
  } catch (error) {
    console.error('Erreur dans le contrôleur playerTurn:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const getDicesResults = async (req, res) => {
  console.log('in getDicesResults');

  try {
    const payload = {
      username: req.body.username,
      idRoom: req.body.idRoom,
      dices: dicesRoll(6),
    };
    await pusher.trigger(`DollarCanadien-${payload.idRoom}`, 'dicesResults', payload);
    res.status(200).send(payload);
  } catch (error) {
    console.error('Erreur dans le contrôleur dicesResults:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const diceLockIn = async (req, res) => {
  console.log('diceLockIn');
  // Renvoie au gens le choix de la personne et son score si il ne lui reste pas de dé disponible et ses HPs
  try {
    const payload = req.body;
    await pusher.trigger(`DollarCanadien-${payload.idRoom}`, 'diceLockIn', payload);
    res.status(200).send(payload);
  } catch (error) {
    console.error('Erreur dans le contrôleur diceLockIn:', error);
    res.status(500).send("Une erreur s'est produite");
  }
};
