# Dollar Canadien

Ce projet est une application de chat éphémère permettant aux utilisateurs de communiquer de manière anonyme et éphémère.

## Fonctionnalités

- **Chat en temps réel** : Les utilisateurs peuvent envoyer et recevoir des messages en temps réel.
- **Anonymat** : Aucune inscription n'est nécessaire pour utiliser le chat, offrant ainsi un anonymat complet.
- **Éphémère** : Les seules messages que vous verrez son ceux envoyé quand vous êtes dans la discussion , garantissant la confidentialité des conversations.

## Installation

1.  Cloner le dépôt :

```bash
git clone <URL_DU_REPO>
```

2.  Installer les dépendances :

```bash
cd chat-ephemere
npm install
```

3.  Créé le .env pour pusher:

```bash
APP_ID =
APP_KEY =
APP_SECRET =
APP_CLUSTER =
```

4.  Changer l'url de votre site dans le script de chatRoom.html:

```javascript
const link = 'http://localhost:3000';`
```

5.  Démarrer le serveur :

```bash
node app
```

6.  Accéder à l'application dans votre navigateur :

[http://localhost:3000](http://localhost:3000)

## Technologies Utilisées

- **Node.js** : Plateforme JavaScript côté serveur.
- **Express.js** : Framework web pour Node.js.
- **Pusher** : Bibliothèque JavaScript pour les applications web en temps réel.
- **JavaScript** : Langage de programmation pour la logique côté client et côté serveur.

## Contribuer

Les contributions sont les bienvenues ! Pour les suggestions d'amélioration, veuillez ouvrir une "issue" pour discuter des changements proposés. Pour les contributions directes, veuillez ouvrir une "pull request" avec vos modifications.

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
