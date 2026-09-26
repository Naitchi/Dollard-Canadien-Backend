import { MAX_MESSAGE_LENGTH, createMessage, normalizeMessage } from '../functions/chat.js';
import pusher from '../pusher.js';
import { HttpError, channel, controller, findGame, requirePlayer } from './helpers.js';


export const sendMessage = controller('sendMessage', async (req, res) => {
  const { id, user } = req.body;
  const game = await findGame(id);
  const player = requirePlayer(game, user);
  const text = normalizeMessage(req.body.text);
  if (!text) {
    throw new HttpError(422, `Le message doit faire entre 1 et ${MAX_MESSAGE_LENGTH} caractères.`);
  }

  const message = createMessage(player, text);
  await pusher.trigger(channel(id), 'chatMessage', message);
  res.status(201).send(message);
});
