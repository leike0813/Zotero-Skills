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
  <a href="../README.md">English</a> ·
  <a href="./README-zhCN.md">简体中文</a> ·
  Français ·
  <a href="./README-jaJP.md">日本語</a>
</p>

---

## ✨ Qu'est-ce que Zotero Skills ?

Zotero Skills est un **plugin-cadre** (framework) pour Zotero 7, offrant un moteur d'exécution universel pour les workflows IA et d'automatisation :

- 📦 **Workflows modulaires** — La logique métier réside dans des packages de workflows externes, pas dans le cœur du plugin.
- 🔌 **Support multi-backends** — Routez les tâches vers [Skill-Runner](https://github.com/leike0813/Skill-Runner), des APIs HTTP génériques ou une logique locale pass-through.
- ⚡ **Exécution unifiée** — Contexte de sélection, compilation de requêtes, file d'attente de jobs, application des résultats et gestion des erreurs sont traités par un runtime partagé.

> Pensez-y comme un **moteur de workflows dans Zotero** — vous définissez *quoi* faire via des manifestes déclaratifs et des scripts hook, et le plugin gère *comment* l'exécuter.

## 🚀 Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| **Moteur de workflows** | Manifestes déclaratifs `workflow.json` + hooks optionnels (`filterInputs`, `buildRequest`, `applyResult`) |
| **Registre de providers** | Trois providers intégrés : `skillrunner`, `generic-http`, `pass-through` |
| **Gestionnaire de backends** | Interface graphique pour configurer plusieurs profils backend par type de provider |
| **Tableau de bord** | Suivi des jobs en temps réel, interaction chat SkillRunner, journaux |
| **Paramètres de workflow** | Substitutions persistantes et ponctuelles par workflow |
| **Éditeur de workflow** | Framework de rendu basé sur un hôte pour l'édition de données structurées |
| **Visualiseur de journaux** | Journaux filtrables avec export NDJSON pour le diagnostic |

## 📋 Workflows intégrés

| Workflow | Provider | Description |
|---|---|---|
| **Digest bibliographique** | `skillrunner` | Génère des notes digest/références depuis un contexte markdown ou PDF |
| **Explicateur de littérature** | `skillrunner` | Interprétation interactive de la littérature avec notes de conversation |
| **Correspondance de références** | `pass-through` | Apparie les références aux citekeys, réécrit les payloads structurés |
| **Éditeur de notes de références** | `pass-through` | Édite les entrées structurées dans un dialogue dédié |
| **MinerU** | `generic-http` | Analyse les PDF, matérialise le markdown/les ressources, rattache au parent |
| **Gestionnaire de tags** | `pass-through` | CRUD vocabulaire contrôlé, filtrage par facettes, import/export YAML |
| **Régulateur de tags** | `skillrunner` | Normalise les tags via Skill-Runner, importe les tags suggérés |

## 📥 Installation

### Prérequis

- [Zotero 7](https://www.zotero.org/download/) (version ≥ 6.999)
- Pour les workflows `skillrunner` : une instance [Skill-Runner](https://github.com/leike0813/Skill-Runner) en cours d'exécution

### Étapes d'installation

1. Téléchargez le dernier fichier `.xpi` depuis la page [Releases](https://github.com/leike0813/Zotero-Skills/releases).
2. Dans Zotero → `Outils` → `Extensions` → ⚙️ → `Installer un module depuis un fichier…`
3. Sélectionnez le fichier `.xpi` téléchargé et redémarrez Zotero.

### Démarrage rapide

1. **Configurer un backend** — `Édition` → `Préférences` → `Zotero Skills` → `Backend Manager`, ajoutez votre point d'accès Skill-Runner.
2. **Placer les workflows** — Copiez les dossiers de workflows dans le répertoire configuré dans les préférences.
3. **Utiliser** — Clic droit sur les éléments sélectionnés → `Zotero-Skills` → choisissez un workflow.

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

| Document | Description |
|---|---|
| [Flux d'architecture](architecture-flow.md) | Aperçu du pipeline d'exécution (diagrammes Mermaid) |
| [Guide de développement](dev_guide.md) | Composants principaux, modèle de config, chaîne d'exécution |
| [Workflows](components/workflows.md) | Schéma du manifeste, hooks, filtrage d'entrées |
| [Providers](components/providers.md) | Système de contrats provider, types de requêtes |
| [Tests](testing-framework.md) | Stratégie double-runner, modes lite/full, portes CI |

## 📄 Licence

[AGPL-3.0-or-later](../LICENSE)

## 🙏 Remerciements

- Construit sur le [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) de [@windingwind](https://github.com/windingwind)
- Propulsé par [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
