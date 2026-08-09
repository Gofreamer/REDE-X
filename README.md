# Rede X

Twitter in-world para a mesa de RPG. Fio da cidade, rumores, mídia e NPC.

## Stack

HTML + CSS + JS vanilla · Firebase Auth · Realtime Database

## Como rodar

```bash
npx serve .
```

## Setup Firebase

1. Authentication → E-mail/senha **ativado**
2. Realtime Database criado
3. Rules: cole `database.rules.json` (ou `true/true` só no começo)
4. Crie conta admin no site → Perfil → copie UID
5. Console → `users/{UID}/isAdmin = true` (boolean)
6. F5 → menu **Admin**

## Contas sugeridas

| Papel  | E-mail              |
|--------|---------------------|
| Admin  | admin@rede.rpg      |
| Player | player@rede.rpg     |

## O que tem no MVP

- Login / registro com **@handle**
- Timeline (fio)
- Postar (280 caracteres + imagem URL)
- Responder
- Curtir
- Perfil (nome, bio, avatar)
- Admin: postar **como NPC** (`@nina_riders`, `@globalsmith`…)
- Apagar post (próprio ou admin)

## Estrutura no RTDB

```
users/{uid}     → perfil
handles/{handle} → uid
posts/{id}      → texto, handle, likes, replyTo
```
