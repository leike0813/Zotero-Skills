<p align="center">
  <img src="../addon/content/icons/icon_full.png" alt="Zotero Skills" width="128" />
</p>

<h1 align="center">Zotero Skills</h1>

<p align="center">
  <strong>Un moteur de workflows modulaire pour Zotero 7 — transformez votre bibliothèque en centre de recherche IA.</strong>
</p>

<p align="center">
  <a href="https://github.com/leike0813/Zotero-Skills/releases"><img src="https://img.shields.io/github/v/release/leike0813/Zotero-Skills?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/leike0813/Zotero-Skills/blob/main/LICENSE"><img src="https://img.shields.io/github/license/leike0813/Zotero-Skills?style=flat-square" alt="License" /></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white" alt="Zotero 7" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README-zhCN.md">简体中文</a> ·
  Français ·
  <a href="README-jaJP.md">日本語</a>
</p>

---

## ✨ Qu'est-ce que Zotero Skills ?

Zotero Skills est un **plugin-cadre** (framework) pour Zotero 7, offrant un moteur d'exécution universel pour les workflows IA et d'automatisation :

- 📦 **Workflows modulaires** — La logique métier réside dans des packages de workflows externes, pas dans le cœur du plugin.
- 🔌 **Support multi-backends** — Routez les tâches vers [Skill-Runner](https://github.com/leike0813/Skill-Runner), des APIs HTTP génériques ou une logique locale pass-through.
- ⚡ **Exécution unifiée** — Contexte de sélection, compilation de requêtes, file d'attente de jobs, application des résultats et gestion des erreurs sont traités par un runtime partagé.

> Pensez-y comme un **moteur de workflows dans Zotero** — vous définissez _quoi_ faire via des manifestes déclaratifs et des scripts hook, et le plugin gère _comment_ l'exécuter.

## 🚀 Fonctionnalités principales

| Fonctionnalité               | Description                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Moteur de workflows**      | Manifestes déclaratifs `workflow.json` + hooks optionnels (`filterInputs`, `buildRequest`, `applyResult`) |
| **Registre de providers**    | Trois providers intégrés : `skillrunner`, `generic-http`, `pass-through`                                  |
| **Gestionnaire de backends** | Interface graphique pour configurer plusieurs profils backend par type de provider                        |
| **Tableau de bord**          | Suivi des jobs en temps réel, interaction chat SkillRunner, journaux                                      |
| **Paramètres de workflow**   | Substitutions persistantes et ponctuelles par workflow                                                    |
| **Éditeur de notes**         | Rendu basé sur un hôte pour l'édition de données structurées (ex. notes de références)                    |
| **Visualiseur de journaux**  | Journaux filtrables avec export NDJSON pour le diagnostic                                                 |

## 💡 Recommandations de moteur

### Codex (Recommandation principale)

- **Avantages** : Performance de premier ordre pour les outils CLI agent et les modèles LLM (vitesse, compréhension, stabilité de sortie). Supporte le flux de pensée. Exécution extrêmement stable. Version gratuite disponible avec restrictions d'accès aux modèles.
- **Inconvénients** : La version gratuite a des restrictions d'accès aux modèles (peut ne pas inclure les modèles les plus récents/les plus puissants).
- **Verdict** : Recommandation principale pour la plupart des utilisateurs. Même la version gratuite offre d'excellents résultats.

### Opencode

- **Avantages** : Supporte plusieurs fournisseurs de modèles. Fortement recommandé avec Alibaba Wanli Coding Plan, Zhipu Coding Plan, etc. Les modèles comme Qwen3.5-Plus, MiniMax-M2.5, Kimi-K2.5, GLM-5 ont d'excellentes performances dans la compréhension, l'extraction et la synthèse de littérature — parfaitement pratiques pour les workflows réels.
- **Inconvénients** : La vitesse peut être incohérente. L'intégration DeepSeek API est utilisable mais le modèle V3.2 est significativement en retard ; utiliser "reasoner" aide mais peut nécessiter de la patience. Le support Antigravity tiers existe mais comporte un risque de bannissement.
- **Verdict** : Meilleure option gratuite/faible coût si vous avez accès à des clés API ou abonnements compatibles.

### Qwen Code (Recommandé pour les utilisateurs gratuits à fort volume)

- **Avantages** : La connexion OAuth officielle offre **1000 appels gratuits par jour à Qwen3.6-Plus** — l'un des quotas gratuits les plus généreux disponibles. Excellentes performances sur les tâches de littérature.
- **Inconvénients** : Nécessite un compte Alibaba Cloud pour l'authentification OAuth.
- **Verdict** : **Choix n°1 pour les utilisateurs gratuits** qui ont besoin d'un quota élevé sans payer.

### Gemini-CLI

- **Avantages** : Tier gratuit disponible.
- **Inconvénients** : Démarrage lent, mauvaise expérience pour les tâches interactives. **Google a considérablement réduit les quotas d'abonnement Pro**, ce qui rend le rapport qualité-prix généralement mauvais.
- **Verdict** : Gemini-3-Flash reste un bon choix pour les tâches simples uniquement.

### iFlow-CLI (Obsolète)

- **Avis** : **iFlow-CLI sera arrêté le 17 avril 2026.** Non recommandé pour les nouveaux déploiements.
- **Avantages** : Entièrement gratuit (tant que le service dure).
- **Inconvénients** : Mauvaise compréhension des skills, exécution et stabilité de sortie structurée. Les tâches en mode interactif échouent souvent à se terminer de manière fiable.
- **Verdict** : Service en cours d'arrêt — migrez vers d'autres moteurs.

### Claude Code

- **Note** : L'intégration officielle Claude Code (authentification officielle + modèles officiels) n'a **pas été testée par l'auteur** — pour être franc, **pas d'abonnement Anthropic acheté**. Disons simplement qu'Anthropic est peut-être *trop* "conforme légalement" pour certaines régions 🤷.
- **Solution** : Ce projet fournit des points d'entrée de configuration pratiques pour les providers tiers. Les utilisateurs ayant leurs propres clés API ou un accès alternatif peuvent configurer en conséquence.
- **BTW** : Utiliser un abonnement si cher pour ce projet ressemble un peu à un gaspillage — abonnement officiel recommandé aux **utilisateurs généreux uniquement**.
- **Verdict** : Si vous avez déjà un accès Claude par d'autres moyens, cela fonctionne bien — mais la barrière à l'entrée est plus élevée que les autres options.

## 📋 Workflows intégrés

### Literature Workbench Package

Un package unifié pour les workflows de traitement de littérature :

| Workflow                           | Provider       | Description                                                                 |
| ---------------------------------- | -------------- | --------------------------------------------------------------------------- |
| **Digest bibliographique**         | `skillrunner`  | Génère des notes digest, références et analyse de citations                 |
| **Explicateur de littérature**     | `skillrunner`  | Interprétation interactive de la littérature avec notes de conversation     |
| **Export de notes**                | `pass-through` | Exporte les notes personnalisées (markdown/HTML) et les artifacts           |
| **Import de notes**                | `pass-through` | Importe des fichiers markdown comme notes personnalisées, multi-sélection |
| **Correspondance de références**   | `pass-through` | Apparie les références aux citekeys, réécrit les payloads structurés        |
| **Éditeur de notes de références** | `pass-through` | Édite les entrées structurées dans un dialogue dédié                        |

### Tag Vocabulary Package

Workflows de gestion de vocabulaire contrôlé :

| Workflow                           | Provider       | Description                                                                 |
| ---------------------------------- | -------------- | --------------------------------------------------------------------------- |
| **Gestionnaire de tags**           | `pass-through` | CRUD vocabulaire contrôlé, filtrage par facettes, synchronisation GitHub    |
| **Régulateur de tags**             | `skillrunner`  | Normalise les tags via suggestions LLM, importe les tags régulés            |

### Autres Workflows

| Workflow                           | Provider       | Description                                                                 |
| ---------------------------------- | -------------- | --------------------------------------------------------------------------- |
| **MinerU**                         | `generic-http` | Analyse les PDF, matérialise le markdown/les ressources, rattache au parent |
| **Workflow Debug Probe**           | `pass-through` | Workflow de diagnostic pour le dépannage des problèmes runtime (visible uniquement en mode debug) |

## 📥 Installation

### Prérequis

- [Zotero 7](https://www.zotero.org/download/) (version ≥ 6.999)
- Pour les workflows `skillrunner` : une instance [Skill-Runner](https://github.com/leike0813/Skill-Runner) en cours d'exécution

### Étapes d'installation

1. Téléchargez le dernier fichier `.xpi` depuis la page [Releases](https://github.com/leike0813/Zotero-Skills/releases).
2. Dans Zotero → `Outils` → `Extensions` → ⚙️ → `Installer un module depuis un fichier…`
3. Sélectionnez le fichier `.xpi` téléchargé et redémarrez Zotero.

### Démarrage rapide

#### 1. Déployer Skill-Runner (Prérequis)

**Déploiement local en un clic** (Recommandé pour les tests rapides)

1. Ouvrez `Édition` → `Préférences` → `Zotero Skills` → `SkillRunner Local Runtime`
2. Cliquez sur **Deploy** et attendez la fin du déploiement
3. Le backend sera automatiquement configuré

**Déploiement Docker** (Recommandé pour la production)

Voir le guide de déploiement Docker dans [Skill-Runner](https://github.com/leike0813/Skill-Runner) :

```bash
mkdir -p skills data
docker compose up -d --build
```

- **API** : http://localhost:9813/v1
- **Admin UI** : http://localhost:9813/ui

#### 2. Configurer un backend

_Si vous n'utilisez pas le déploiement en un clic_ : `Édition` → `Préférences` → `Zotero Skills` → `Backend Manager`, ajoutez votre point d'accès Skill-Runner.

#### 3. Placer les workflows

Copiez les dossiers de workflows dans le répertoire configuré dans les préférences.

#### 4. Utiliser

Clic droit sur les éléments sélectionnés → `Zotero-Skills` → Choisissez un workflow.

## 🏗️ Aperçu de l'architecture

```
Déclenchement utilisateur
    │
    ▼
Contexte de sélection ──► Moteur de workflows ──► Registre de providers ──► File de jobs
                               │                         │                      │
                         workflow.json              Résolution du            FIFO + contrôle
                         + scripts hook             profil backend           de concurrence
                               │                         │                      │
                               ▼                         ▼                      ▼
                         Construction ──► Résolution provider ──► Exécution & Application
                         des requêtes                                    │
                                                                   Handlers :
                                                                   note / tag /
                                                                   pièce jointe / élément
```

## 💰 Avantage coût

- Routez les appels via des backends alignés sur vos abonnements existants.
- Exploitez les quotas d'abonnement renouvelés périodiquement (par ex. plans OpenAI/Gemini) plutôt que la facturation API par token.
- Le plugin reste agnostique au provider côté UI/workflow, tandis que la stratégie backend évolue indépendamment.

## 🧑‍💻 Développement

```bash
npm install          # Installer les dépendances
npm start            # Serveur de développement (avec mock Skill-Runner)
npm test             # Tests lite (retour rapide)
npm run test:full    # Tests complets
npm run build        # Build de production
```

Voir le [Guide de développement](dev_guide.md) pour les détails.

## 📖 Documentation

| Document                                    | Description                                                 |
| ------------------------------------------- | ----------------------------------------------------------- |
| [Flux d'architecture](architecture-flow.md) | Aperçu du pipeline d'exécution (diagrammes Mermaid)         |
| [Guide de développement](dev_guide.md)      | Composants principaux, modèle de config, chaîne d'exécution |
| [Workflows](components/workflows.md)        | Schéma du manifeste, hooks, filtrage d'entrées              |
| [Providers](components/providers.md)        | Système de contrats provider, types de requêtes             |
| [Tests](testing-framework.md)               | Stratégie double-runner, modes lite/full, portes CI         |

## 📄 Licence

[AGPL-3.0-or-later](../LICENSE)

## 🙏 Remerciements

- Construit sur le [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) de [@windingwind](https://github.com/windingwind)
- Propulsé par [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
