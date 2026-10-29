# professional-portfolio
A professional project repository following industry best practices and standards

## Connecteur Microsoft 365 / OneDrive (MCP)

`.mcp.json` déclare un serveur MCP `m365` ([`@softeria/ms-365-mcp-server`](https://github.com/Softeria/ms-365-mcp-server))
qui donne à Claude Code un accès à OneDrive / fichiers Office via Microsoft Graph.
Les outils exposés sont limités aux fichiers (`--enabled-tools`) ; élargir le filtre pour ajouter Mail, Calendrier, Teams, etc.

### Mise en place

1. (Optionnel) Enregistrer une application dans Microsoft Entra ID (client public, flux « device code »)
   avec les permissions déléguées Microsoft Graph `Files.ReadWrite.All` et `User.Read`, puis exporter :
   ```bash
   export MS365_MCP_CLIENT_ID=<application-client-id>
   export MS365_MCP_TENANT_ID=<tenant-id>   # défaut : common
   ```
   Sans `MS365_MCP_CLIENT_ID`, le serveur utilise son application par défaut ; un tenant d'entreprise
   peut exiger un consentement administrateur pour une application tierce.
2. Se connecter une fois : `npx -y @softeria/ms-365-mcp-server --login` (code appareil à saisir sur https://microsoft.com/devicelogin).
3. Lancer Claude Code dans ce dépôt, accepter le serveur `m365` et vérifier avec `/mcp`.

Aucun secret n'est stocké dans le dépôt : le jeton est conservé localement par le serveur MCP.
