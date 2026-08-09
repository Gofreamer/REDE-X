/* Rede X — State */
const state = {
  user: null,
  profile: null,
  posts: [],
  profiles: {},
  currentView: 'home',
  replyTo: null,
  composeAs: null // admin: handle override
};

const ADMIN_UIDS = [];
