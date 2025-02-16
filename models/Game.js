import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const playerSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  index: { type: Number, default: null },
  username: { type: String, required: true },
  ready: { type: Boolean, default: false, required: true },
  hp: { type: Number, required: true, default: 30 },
  lockedDices: { type: [Number], default: [] },
  dices: { type: [Number], default: [] },
  attackDices: { type: [[Number]], default: [] },
});

const gameSchema = new mongoose.Schema({
  private: { type: String, default: false, required: true },
  host: {
    id: { type: String, default: null },
    username: { type: String, default: null },
  },
  actif: { type: String, default: null },
  step: { type: String, default: 'throw' },
  players: { type: [playerSchema], default: [] },
});

gameSchema.plugin(uniqueValidator);

const Game = mongoose.model('Game', gameSchema);

export default Game;
