async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (ex) {
    err.textContent = translateAuthError(ex.code, ex.message);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const handle = normalizeHandle(document.getElementById('register-handle').value);
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const err = document.getElementById('register-error');
  const btn = document.getElementById('btn-register');
  err.textContent = '';

  if (handle.length < 2) {
    err.textContent = 'Handle inválido (mín. 2, a-z 0-9 _).';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Criando…';
  try {
    const taken = await db.ref('handles/' + handle).once('value');
    if (taken.exists()) {
      err.textContent = 'Esse @ já está em uso.';
      btn.disabled = false;
      btn.textContent = 'Criar conta';
      return;
    }
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const profile = {
      name: name || handle,
      handle,
      email,
      bio: '',
      avatar: '',
      isAdmin: false,
      createdAt: Date.now()
    };
    await db.ref('users/' + uid).set(profile);
    await db.ref('handles/' + handle).set({ uid, name: profile.name });
  } catch (ex) {
    console.error(ex);
    err.textContent = translateAuthError(ex.code, ex.message);
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

async function handleLogout() {
  await auth.signOut();
}

function translateAuthError(code, message) {
  const map = {
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'E-mail já em uso.',
    'auth/weak-password': 'Senha: mínimo 6 caracteres.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/operation-not-allowed': 'E-mail/senha desativado no Firebase.',
    'auth/network-request-failed': 'Falha de rede.',
    'PERMISSION_DENIED': 'Rules bloquearam. Publique as rules do projeto.'
  };
  if (map[code]) return map[code];
  if (message && /permission/i.test(message)) return map.PERMISSION_DENIED;
  return message || 'Erro ao autenticar.';
}

function switchAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function showAppShell() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
