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

## IA e App Check
- Produção: https://rede-x.pages.dev/
- Firebase AI Logic: SDK modular 13.0.0, Gemini 3.8 Flash como padrão.
- Modelos alternativos: Gemini 3.6 Flash e 3.5 Flash-Lite, se o modelo estiver indisponível ou temporariamente sobrecarregado. Falhas de App Check, permissão e cota não disparam novas chamadas.
- App Check: reCAPTCHA Enterprise de produção, chave pública restrita a `rede-x.pages.dev`, renovação automática e tokens de uso único nas solicitações de IA.
- A proteção básica do App Check deve permanecer aplicada ao Firebase AI Logic no console. Autenticação e Realtime Database têm configuração independente.
- Ao trocar o domínio, adicione-o à lista de domínios da chave Enterprise antes de publicar.
- Para desenvolvimento local, ative explicitamente o provedor de depuração antes de carregar o módulo de IA e cadastre o token no App Check. Não publique tokens de depuração.
- Testes: `node --test tests/firebase-ai.test.cjs`.

