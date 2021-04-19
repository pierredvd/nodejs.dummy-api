## Dummy server
Une solution rapide pour lancer localement un service bouchon pour les Api REST
Requiert Nodejs >= 8
```
node bootstrap.js
```
Le service exploite 2 ports : **8008** et le  **8009**

Le port 8008 est fait pour être attaqué directement par le mobile et attend des GET ou POST raw. 
Le port 8009 est un serveur web de contrôle pour permet de simuler une requête a partir d'un navigateur web (localhost:8009).

Par simplicité, ici pas de distinction entre get et post, un **get** sera consideré comme un **post** avec un json vide.
Le serveur répond aussi bien un host virtuel qu'a un appel via ip (Attention la solution de prod ne sera pas aussi permissive, elle devra imperativement passer par un DNS).

# Configuration

Pour définir le comportement du bouchon, tout se trouve dans le fichier **manifest.json** a la racine. Il contient un grand fichier json appliquant des règle de routage et des conditions de réponses. Comme la plupart des système de routage, il va parcourir ligne par ligne les possibilités, et s’arrêtera à la première possibilité correspondante.
```
	{
		"route"			: "\/login",
		"conditions"	: {
			"email"		: "[^@]+@csgroup.eu",
			"password"	: ".*"
		},		
		"response"		: {
			"code": 200,
			"body": {
				"token": "2c3de6549a12f1c136ae5df4e63a4def"
			}
		}
	},
	{
		"route"			: "\/login",
		"conditions"	: {
			"email"		: ".*",
			"password"	: ".*"
		},		
		"response"		: {
			"code": 403,
			"body": {
				"error": "authentification rejected" 
			}
		}
	},
	{
		"route"			: "\/login",
		"response"		: {
			"code"		: 404,
			"body"		: {
				"error"	: "missing parameters (require 'email' and 'password')"
			}
		}
	},
```
Dans l'exemple ci dessus, on a défini 3 fois un route pour l'url **/login**, ce n'est pas un erreur, mais délibéré.
Si tu fais attention, chaque bloc dispose ou non d'une entrée **conditions**, ce paramètres permet de définir selon les valeurs renseignée si la route la réponse de la route sera retournée ou pas.
Par exemple :
```
		"conditions"	: {
			"email"		: "[^@]+@csgroup.eu",
			"password"	: ".*"
		},
```
Ce blog retournera la réponse de la route si en dans les données json envoyée en $_POST, il existe une entrée **email** et que cette entrée correspond a la regexp **/[^@]+@csgroup.eu/**, et s'il existe un entrée **password**. Si ce n'est pas le cas, le bloc est ignoré et le routeur continuera à chercher un bloc qui correspond.

Ainsi pour les requêtes suivantes:
```
url : /index
data: {
	"email": "toto@csgroup.eu",
	"password": "123456"
}
>> Active le bloc 1

url : /index
data: {
	"email": "toto@gmail.com",
	"password": "123456"
}
>> Active le bloc 2 car n'est pas sur le domaine csgroup.eu

url : /index
data: {
	"login": "toto@gmail.com",
	"motdepasse": "123456"
}
>> Active le bloc 3 car les parametres attendu sont "email" et "password"
```

# Conditions avancées
Tu as sans doute remarquée ce bloc dans le **manifest.json** par default
```
	{
		"route"			: "\/content\/([0-9]+)",
		"conditions"	: {
			"$1" 		: "4[0-9]",
			"data.up"	: "(on|yes)"
		},
		"response"		: {
			"code"		: 200,
			"body"		: { 
				"content": "found"
			}
		}
	}
```
On vois apparaitre 2 elements :
```
"$1" : "4[0-9]",
```
Ce parametre designe le premier groupe dynamique de la regex "route".
Par exemple, pour l'url **/content/42**, 
			 la route **\/content\/([0-9]+)** 
			 definira **$1 : "42"**
pour l'url **/content/7/13/17**, 
la route **\/content\/([0-9]+)\/([0-9]+)\/([0-9]+)** 
definiera **$1="7"**, **$2="13"**, **$3="17"**

On peut ensuite definir des conditions "$1": "[regex]" pour filtrer le routage sur des valeur particulière.
Par exemple, pour la route **\/content\/([0-9]+)** on pourra definir la condition **"$1": "(1|2|3|4)"** si on veut qu'elle réponde qu'aux urls **/content/1**, **/content/2**, **/content/3** et **/content/4** 

De cette manière tu pourras simuler la réponse d'un contenu dont l'id est passé en url en mettant des conditions sur les paramètres extraits de l'url.
Néanmoins attention sur un point , toutes les valeurs issue du routeur sont des chaines de caractères, attention au typage dans le json.
```
"data.up" : "(on|yes)",
```
Cette condition permet quand à elle d'aller chercher un valeur en profondeur dans le json.
Par exemple pour le json
```
{
	"user": {
		"favorites": {
			"music": "electro"
		}
	}
}
```
On pourra poser la conditions :
**"user.favorites.music": ".*"** si l'utilisateur doit avoir une musique favorite, peut importe ce que c'est
La condition ignorera la route si l'attribut "user", "user > favorites" ou "user > favorites > music" n'existe pas

En jouant sur les combinaisons de conditions, il est possible de simuler presque toutes les requêtes que l'on pourrais attendre avec un résultat spécifique quand il y a besoin, ou génériques quand ça n'a pas d'importance.

# Le petit plus

Après modification du fichier **manifest.json**, le serveur fera un auto-reload, pas besion de relancer le service.