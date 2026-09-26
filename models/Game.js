import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { generateLobbyId } from '../functions/lobby.js';

const GAME_TTL_SECONDS = 60 * 60 * 24;

const playerSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  secret: { type: String, required: true },
  index: { type: Number, default: null },
  username: { type: String, required: true },
  ready: { type: Boolean, default: false, required: true },
  hp: { type: Number, required: true, default: 30 },
  lockedDices: { type: [Number], default: [] },
  dices: { type: [Number], default: [] },
  attackDices: { type: [[Number]], default: [] },
});

// Appliqué à chaque sérialisation (res.send, pusher.trigger, JSON.stringify).
playerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.secret;
    return ret;
  },
});

// TODO stocker le nombre de degats par source pour pouvoir les afficher genre "10degats de survie, 10degats par "lui",etc,..."

// TODO faire un champ step par personne ? plutot que global ?

const gameSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateLobbyId },
    private: { type: Boolean, default: true, required: true },
    maxPlayers: { type: Number, default: 99, required: true },
    maxHp: { type: Number, default: 30, required: true },
    host: {
      id: { type: String, default: null },
      username: { type: String, default: null },
    },
    creatorId: { type: String, default: null },
    actif: { type: String, default: null },
    step: {
      type: String,
      enum: [
        'none',
        'dicesAnimation',
        'dices',
        'lockAnimation',
        'scoreAdditionAnimation',
        'attack',
        'damage',
        'gameEnd',
      ],
      default: 'none',
      required: true,
    },
    stake: {
      target: { type: String, enum: ['firstLoser', 'losers', 'winner'], default: 'firstLoser' },
      text: { type: String, default: '', maxlength: 100 },
    },
    eliminated: { type: [String], default: [] },
    turnDeadline: { type: Date, default: null },
    turnLimit: { type: Date, default: null },
    players: { type: [playerSchema], default: [] },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

gameSchema.index({ updatedAt: 1 }, { expireAfterSeconds: GAME_TTL_SECONDS });

gameSchema.plugin(uniqueValidator);

const Game = mongoose.model('Game', gameSchema);

export default Game;
