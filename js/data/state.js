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
  following: {},
  mediaLibrary: [],
  saves: {},          // postId -> timestamp (coleção privada do player)
  currentView: 'feed',
  viewProfileHandle: null,
  activePost: null,
  composeOpen: false,
  unreadNotifs: 0,
  unreadDms: 0,
  feedFilter: 'all', // all | following | tag
  feedTag: null,
  profileTab: 'posts', // posts | saved
  postsLoaded: false,
  profileLoaded: false
};

const ADMIN_UIDS = [];
