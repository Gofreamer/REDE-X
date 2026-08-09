const state = {
  user: null,
  profile: null,
  posts: [],
  profiles: {},
  npcProfiles: {},
  stories: [],
  highlights: {},
  notifications: [],
  dms: {},
  dmThreads: [],
  activeDmId: null,
  siteSettings: {},
  currentView: 'feed',
  viewProfileHandle: null,
  activePost: null,
  composeOpen: false,
  unreadNotifs: 0,
  unreadDms: 0
};

const ADMIN_UIDS = [];
