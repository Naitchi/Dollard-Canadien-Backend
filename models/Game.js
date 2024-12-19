import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { dicesRoll } from '../functions/functions.js';

const playerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  hp: { type: Number, required: true, default: 30 },
  lockedDices: { type: [Number], default: null },
  dices: { type: [Number], default: null },
});

const gameSchema = new mongoose.Schema({
  actif: { type: String, default: null },
  step: { type: String, default: 'throw' },
  players: { type: [playerSchema], default: [] },
});

gameSchema.plugin(uniqueValidator);

// Middleware : Assigner automatiquement le champ `actif` a un joueur si il est vide.
gameSchema.pre('save', function (next) {
  if (!this.actif && this.players.length > 0) {
    this.actif = this.players[0]._id;
    this.players[0].dices.push(...dicesRoll(6));
  }
  next();
});

const Game = mongoose.model('Game', gameSchema);

export default Game;
