<p align="center">
  <img src="../addon/content/icons/icon_full.png" alt="Zotero-Skills Icon" width="160" />
</p>

# Zotero-Skills

Zotero-Skills est un plugin Zotero 7 qui transforme Zotero en interface frontale modulaire pour des workflows IA et d'automatisation.

Langues : [English](../README.md) | [简体中文](./README-zhCN.md) | Français

## Quel problème ce projet résout

Ce projet fournit une couche d'exécution réutilisable dans Zotero :

- Il gère de façon unifiée le contexte de sélection, l'exécution des workflows, le suivi des jobs et l'application des résultats.
- Il sépare la logique métier du cœur du plugin.
- Il permet d'ajouter ou de remplacer des comportements via des packages de workflows externes.

En bref, Zotero-Skills est conçu comme un plugin-cadre (framework), et non comme un plugin mono-fonction.

## Architecture modulaire (pluggable)

Le plugin adopte un modèle de workflows modulaires :

- Chaque workflow est défini par `workflow.json` et des hooks optionnels (`filterInputs`, `buildRequest`, `applyResult`).
- Le runtime compile les requêtes, résout providers/backends, exécute les jobs et applique les résultats de manière uniforme.
- Les packages de workflows peuvent viser différents backends (Skill-Runner, generic HTTP, logique locale pass-through) sans modifier le code central.

Avantages principaux :

- Extensibilité : ajout de workflows sans changer l'architecture du noyau.
- Isolation : la logique spécifique reste dans chaque package de workflow.
- Réutilisation : runtime, file de jobs, réglages et comportement UI partagés.

## Agent Skills nécessite Skill-Runner

Pour l'exécution d'Agent Skills, Zotero-Skills dépend de [Skill-Runner](https://github.com/leike0813/Skill-Runner) comme backend d'orchestration :

- Zotero-Skills construit des requêtes normalisées à partir de la sélection Zotero.
- Skill-Runner orchestre l'exécution des skills et l'intégration côté backend.
- Zotero-Skills récupère les sorties puis les applique aux éléments, notes et pièces jointes Zotero.

Sans Skill-Runner, les workflows Agent Skills ne peuvent pas être exécutés de bout en bout.

## Modèle de coût et avantage des quotas d'abonnement

Cette architecture aide à mieux maîtriser le coût d'usage des LLM :

- Vous pouvez router les appels via Skill-Runner et des intégrations alignées avec vos abonnements existants.
- Dans de nombreux scénarios, cela permet de mieux exploiter des quotas d'abonnement périodiquement renouvelés (par exemple OpenAI/Gemini) au lieu d'appels API facturés directement au token.
- Le plugin reste agnostique au provider côté UI/workflow, tandis que la stratégie backend peut évoluer indépendamment.

## Cas d'usage typiques (Flux de travail intégrés)

- Workflow de digest bibliographique : génération de notes digest/références depuis un contexte markdown/PDF sélectionné.
- Workflow de correspondance de références : appariement des références vers des citekeys et réécriture d'un payload structuré.
- Workflow MinerU : analyse de PDF sélectionnés, matérialisation markdown/ressources, puis rattachement au parent.

## Navigation rapide

- Architecture et état actuel : [doc/dev_guide.md](./dev_guide.md)
- Détails du composant workflows : [doc/components/workflows.md](./components/workflows.md)
- Détails du composant providers : [doc/components/providers.md](./components/providers.md)
- Stratégie de test : [doc/testing-framework.md](./testing-framework.md)

## Origine du template

Ce dépôt a été initialement généré à partir de [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template), puis a évolué vers l'architecture et l'implémentation actuelles de Zotero-Skills.
