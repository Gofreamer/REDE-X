# Rede Global

Instagram in-world para a mesa de RPG.

## Stack
HTML + CSS + JS · Firebase Auth · Realtime Database (projeto `rede-x`)

## Setup
1. Auth e-mail/senha ativado
2. Publicar `database.rules.json` (obrigatório após update — inclui `saves` e `stories/viewers`)
3. Criar conta → Perfil → copiar UID → `users/{uid}/isAdmin = true`
4. F5 → tab Admin

## Features
- Feed visual (imagem obrigatória)
- Stories (24h, admin) + lista de viewers (só admin vê)
- Curtir (duplo clique na foto)
- Comentários (players comentam em posts de NPC)
- Perfil com grade + aba **Salvos** (coleção privada)
- Postar como NPC no admin
- Posts fixados
- Menções com notificação + badge no mobile
- Compartilhar post (copia link `#post/id`)
- Conta verificada (admin marca ✓)

## Deploy
Suba a pasta no GitHub / Hosting.
Relembre de publicar as regras do Realtime Database atualizadas.
