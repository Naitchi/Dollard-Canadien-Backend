export const showResult = (results, div) => {
  console.log(results, div);

  results.forEach((result, index) => {
    const dice = document.createElement('button');
    dice.id = index;
    dice.textContent = result;
    div.appendChild(dice);
  });
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
