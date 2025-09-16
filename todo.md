# MCP SSH Manager - Roadmap & TODO

## 📊 Statut Global
- **Version actuelle** : 1.0.0
- **Dernière mise à jour** : 2025-09-04
- **CI/CD** : ✅ Tous les workflows passent

## 🎯 Plan A : Quick Wins (Priorité immédiate - 1-2 jours)

### 1. Nettoyage et système de logs [HIGH] ✅
**Statut** : DONE | **Estimation** : 2-3 heures | **Réel** : 45 minutes

- [x] ~~Nettoyer les imports inutilisés dans index.js~~
- [x] Implémenter système de logs avec niveaux (debug, info, warning, error)
- [x] Ajouter mode verbose via variable d'environnement `SSH_VERBOSE=true`
- [x] Logger toutes les commandes SSH exécutées avec timestamps
- [x] Créer helper de log dans `src/logger.js`

**Implémenté** :
- Système de logs complet avec niveaux et couleurs
- Mode verbose activable avec `SSH_VERBOSE=true`
- Historique des commandes dans `.ssh-command-history.json`
- Logs fichier dans `.ssh-manager.log`
- Logging pour connexions, commandes, et transferts de fichiers

**Détails techniques** :
```javascript
// logger.js
export const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
export function log(level, message, data = {}) { /* ... */ }
```

### 2. Synchronisation rsync [HIGH] ✅
**Statut** : DONE | **Estimation** : 4-6 heures | **Réel** : 1 heure

- [x] Créer outil `ssh_sync` basé sur rsync
- [x] Support pour `--exclude` patterns multiples
- [x] Option `--dry-run` pour preview
- [x] Option `--delete` pour suppression
- [x] Progress bar avec statistiques de transfert
- [x] Support bidirectionnel (push/pull)

**Implémenté** :
- Synchronisation bidirectionnelle avec préfixes `local:` et `remote:`
- Options rsync complètes : exclude, dry-run, delete, compress, checksum
- Parsing des statistiques rsync (fichiers, taille, vitesse)
- Support SSH avec ports et clés personnalisés
- Logging détaillé de toutes les opérations

**Détails techniques** :
```javascript
// Schéma de l'outil
{
  name: "ssh_sync",
  description: "Synchronize files/folders via rsync",
  inputSchema: {
    server: z.string(),
    source: z.string(),
    destination: z.string(),
    direction: z.enum(["push", "pull"]),
    exclude: z.array(z.string()).optional(),
    dryRun: z.boolean().optional(),
    delete: z.boolean().optional()
  }
}
```

### 3. Monitoring basique [MEDIUM] ✅
**Statut** : DONE | **Estimation** : 3-4 heures | **Réel** : 1.5 heures

- [x] Outil `ssh_tail` pour suivre les logs en temps réel
- [x] Outil `ssh_monitor` pour métriques système (CPU, RAM, disque)
- [x] Historique des commandes avec timestamps dans `.ssh-command-history.json`
- [x] Support pour multiple fichiers de logs simultanés

**Implémenté** :
- `ssh_tail` avec support follow mode et grep filtering
- `ssh_monitor` avec 6 types de monitoring (overview, cpu, memory, disk, network, process)
- Formatage détaillé des métriques système avec emojis
- Support pour monitoring continu (infrastructure prête)
- Intégration complète avec le système de logs

**Détails techniques** :
```javascript
// ssh_tail : tail -f avec gestion du streaming
// ssh_monitor : utilise top, free, df pour collecter métriques
```

## 🚀 Plan B : Infrastructure (Phase 2 - 3-5 jours)

### 4. Sessions SSH persistantes [HIGH] ✅
**Statut** : DONE | **Estimation** : 8-10 heures | **Réel** : 2 heures

- [x] `ssh_session_start` : Ouvre session interactive avec ID unique
- [x] `ssh_session_send` : Envoie commandes dans contexte existant
- [x] `ssh_session_close` : Ferme session proprement
- [x] `ssh_session_list` : Liste sessions actives
- [x] Gestion du contexte (pwd, variables d'environnement)
- [x] Timeout automatique après inactivité

**Implémenté** :
- Module session-manager.js complet avec gestion d'état
- Shell interactif persistant avec contexte maintenu
- Historique des commandes par session
- Variables de session
- Auto-nettoyage des sessions inactives (30 min)
- Support multi-sessions simultanées

**Architecture** :
- Utiliser node-pty pour pseudo-terminal
- Map des sessions actives avec metadata
- Gestion état et contexte par session

### 5. Groupes de serveurs [HIGH] ✅
**Statut** : DONE | **Estimation** : 6-8 heures | **Réel** : 1.5 heures

- [x] Configuration des groupes dans `.server-groups.json`
- [x] `ssh_execute_group` : Exécution parallèle sur groupe
- [x] `ssh_group_manage` : CRUD des groupes
- [x] Support pour rolling deployments avec délai
- [x] Agrégation et formatage des résultats
- [x] Option `--stop-on-error` pour arrêt si échec

**Implémenté** :
- Module server-groups.js avec gestion complète
- 3 stratégies d'exécution : parallel, sequential, rolling
- Groupes dynamiques ('all') et statiques
- Persistence dans .server-groups.json
- Gestion CRUD complète des groupes
- Support pour délais et stop-on-error

**Format configuration** :
```json
{
  "production": ["prod1", "prod2", "prod3"],
  "staging": ["stage1", "stage2"],
  "databases": ["db-master", "db-slave1", "db-slave2"]
}
```

### 6. Tunnels SSH [MEDIUM] ✅
**Statut** : DONE | **Estimation** : 5-6 heures | **Réel** : 2 heures

- [x] `ssh_tunnel_create` : Local/Remote port forwarding
- [x] `ssh_tunnel_list` : Liste tunnels actifs avec stats
- [x] `ssh_tunnel_close` : Fermeture tunnel spécifique
- [x] Support SOCKS proxy (`-D` flag)
- [x] Auto-reconnect si tunnel tombe
- [x] Monitoring santé des tunnels

**Implémenté** :
- Module tunnel-manager.js complet avec 3 types de tunnels
- Local forwarding : Accès services distants localement
- Remote forwarding : Expose services locaux sur serveur distant
- Dynamic forwarding : SOCKS5 proxy pour navigation sécurisée
- Auto-reconnect avec exponential backoff
- Monitoring toutes les 30 secondes
- Statistiques détaillées (connexions, bytes, erreurs)

**Cas d'usage** :
- Accès BDD distante : `local:3306 -> remote:3306`
- Reverse tunnel pour webhooks
- SOCKS proxy pour navigation sécurisée

## 🔐 Plan C : Sécurité & Templates (Phase 3 - 2-3 jours)

### 7. Sécurité renforcée [HIGH]
**Statut** : TODO | **Estimation** : 6-8 heures

- [ ] Support clés SSH avec passphrase (utiliser ssh-agent)
- [ ] Validation commandes dangereuses avec confirmation
- [ ] Blacklist configurable de commandes
- [ ] Audit trail dans `.ssh-audit.log`
- [ ] Rotation automatique des mots de passe
- [ ] Chiffrement local des credentials sensibles

**Commandes dangereuses à valider** :
```javascript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=/,
  /mkfs/,
  /> \/dev\/sd/
];
```

### 8. Templates de déploiement [MEDIUM]
**Statut** : TODO | **Estimation** : 5-6 heures

- [ ] Format YAML pour définir templates
- [ ] Variables avec substitution `{{VAR_NAME}}`
- [ ] Templates prédéfinis : Node.js, Python, WordPress
- [ ] Validation et dry-run avant exécution
- [ ] Support conditions et boucles basiques
- [ ] Import/export de templates

**Exemple template** :
```yaml
name: deploy-nodejs
description: Deploy Node.js application
variables:
  - APP_NAME: required
  - NODE_VERSION: default:20
  - PM2_INSTANCES: default:2
steps:
  - name: Install dependencies
    command: cd /apps/{{APP_NAME}} && npm ci
  - name: Run tests
    command: npm test
  - name: Restart PM2
    command: pm2 restart {{APP_NAME}}
```

### 9. Intégration containers [LOW]
**Statut** : TODO | **Estimation** : 4-5 heures

- [ ] `ssh_docker` : Wrapper pour docker commands
- [ ] `ssh_kubectl` : Wrapper pour kubernetes
- [ ] `ssh_compose` : Gestion docker-compose distant
- [ ] Support pour logs de containers
- [ ] Exec dans containers distants

## 📈 Plan D : Améliorations UX (Phase 4 - Ongoing)

### 10. Auto-complétion et UX [MEDIUM]
**Statut** : TODO | **Estimation** : 3-4 heures

- [ ] Auto-complétion des noms de serveurs
- [ ] Suggestions de commandes basées sur historique
- [ ] Raccourcis pour opérations courantes
- [ ] Messages d'erreur avec suggestions de fix
- [ ] Progress indicators pour opérations longues

### 11. Documentation et tests [MEDIUM]
**Statut** : TODO | **Estimation** : 4-5 heures

- [ ] Tests unitaires pour tous les nouveaux outils
- [ ] Documentation API complète
- [ ] Exemples d'usage pour chaque feature
- [ ] Guide de migration depuis v1.0
- [ ] Tutoriels vidéo pour features complexes

## 📝 Actions immédiates

1. ✅ **Fait** : Correction des workflows GitHub Actions
2. 🔄 **En cours** : Planification et priorisation
3. ⏭️ **Prochain** : Implémenter système de logs (Plan A.1)
4. ⏭️ **Suivant** : Ajouter ssh_sync avec rsync (Plan A.2)

## 🎯 Objectifs par version

### v1.1.0 (Target : 1 semaine)
- Plan A complet (Quick Wins)
- Tests et documentation

### v1.2.0 (Target : 2 semaines)
- Sessions persistantes
- Groupes de serveurs

### v1.3.0 (Target : 3 semaines)
- Sécurité renforcée
- Templates de déploiement

### v2.0.0 (Target : 1 mois)
- Toutes les features majeures
- Interface graphique web (stretch goal)

## 📊 Métriques de succès

- [ ] Réduction de 50% du temps de déploiement multi-serveurs
- [ ] Zero incident de sécurité lié aux commandes SSH
- [ ] 90% de satisfaction utilisateur sur les nouvelles features
- [ ] < 100ms latence pour commandes simples
- [ ] 100% de couverture de tests pour features critiques

## 🐛 Bugs connus

- Connexions SSH timeout après longue inactivité (fix appliqué, à valider)
- Parsing des noms de serveurs avec underscores (fix appliqué)

## 💡 Idées futures

- Interface web pour gestion visuelle
- Intégration avec Ansible/Terraform
- Support pour bastion/jump hosts
- Métriques Prometheus/Grafana
- Backup automatique de configurations
- Support pour Windows (PowerShell remoting)

---
*Dernière mise à jour : 2025-09-04 par Claude Code*