export const messageBox = (data, username, messages) => {
  const box = document.createElement('div');
  box.classList.add('box_message');
  const user = document.createElement('p');
  user.classList.add('username');
  user.textContent = `${data.username}:`;
  const item = document.createElement('p');
  item.classList.add('text');
  item.textContent = data.msg;
  if (data.username === username) {
    box.classList.add('our_message');
  } else {
    box.appendChild(user);
  }
  box.appendChild(item);
  messages.appendChild(box);
  messages.scrollTop = 9999999;
};

export const connexionMsg = (data, messages, type) => {
  // Type is a boolean used to check if it's a connexion or a deconnexion
  const item = document.createElement('p');
  item.classList.add('connexion');
  item.textContent = type
    ? `L'utilisateur ${data.username} vient de se connecter au salon.`
    : `L'utilisateur ${data.username} vient de se déconnecter au salon.`;
  messages.appendChild(item);
  messages.scrollTop = 9999999;
};

export const checkUsername = async (username, idRoom, divUser, divChat, divLoading, link) => {
  console.log('checkUsername');
  if (!divLoading.classList.contains('hide')) divLoading.classList.add('hide');

  if (!username?.trim()) {
    divUser.classList.remove('hide');
    return;
  } else divUser.classList.add('hide');
  divChat.classList.remove('hide');

  console.log('in newChatter');
  try {
    const payload = {
      username: username,
      idRoom: idRoom,
    };
    console.log(payload);
    await axios.post(`${link}/api/newChatter`, payload);
    console.log('newChatter connected');
  } catch (error) {
    console.error('Error sending message:', error);
  }
};
